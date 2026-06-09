import { describe, expect, it } from 'vitest';
import { mapCppFile } from './cppMapper.js';

const CPP_FIXTURE = `#include <vector>
#include <sys/types.h>
#include "util/strings.h"

// comment with #include "fake.h" and void fake_fn(int x);
/* block comment
#include <fake2>
struct FakeStruct { };
*/

namespace widgets {

class Widget {
public:
  Widget(const std::string& name);
  void render(int width, int height) const;
  static Widget* create(const char* id);
  ~Widget();
  bool operator==(const Widget& other) const;
private:
  void helper();
  int width_;
};

struct Point {
  int x;
  int y;
  double dist(const Point& other) const;
};

enum class Mode {
  Fast,
  Slow,
};

using WidgetList = std::vector<Widget>;

void free_render(const Widget& w);

std::map<std::string, int>
build_index(const std::vector<std::string>& names,
            bool case_sensitive = false);

}  // namespace widgets
`;

const C_FIXTURE = `#include "util.h"
#include <stdio.h>

#define MAX_LEN 128
#define SQUARE(x) ((x) * (x))
#define MULTILINE(a, b) \\
  do_something(a, b)

typedef struct Node {
  struct Node* next;
  int value;
} Node;

typedef enum { RED, GREEN } Color;

typedef int (*Comparator)(const void* a, const void* b);

typedef unsigned long count_t;

static int internal_helper(int x) {
  const char* s = "void fake_from_string(int);";
  char c = '}';
  return SQUARE(x);
}

int util_count(const char* text, char needle) {
  if (!text) {
    return 0;
  }
  return internal_helper(1);
}

char* util_strdup(const char* src);
`;

describe('mapCppFile', () => {
  const graph = mapCppFile(CPP_FIXTURE, 'src/widget.hpp');

  it('uses unix-slash path', () => {
    expect(graph.path).toBe('src/widget.hpp');
  });

  it('captures includes and distinguishes local from system', () => {
    expect(graph.imports).toEqual([
      { source: '<vector>', symbols: ['vector'] },
      { source: '<sys/types.h>', symbols: ['types'] },
      { source: 'util/strings.h', symbols: ['strings'] },
    ]);
  });

  it('ignores includes and declarations inside comments', () => {
    const sources = graph.imports.map((i) => i.source);
    expect(sources).not.toContain('fake.h');
    expect(sources).not.toContain('<fake2>');
    const names = graph.exports.map((e) => e.name);
    expect(names).not.toContain('fake_fn');
    expect(names).not.toContain('FakeStruct');
  });

  it('maps a class with its public methods only', () => {
    const widget = graph.exports.find((e) => e.name === 'Widget');
    expect(widget?.kind).toBe('class');
    const methodNames = widget?.methods?.map((m) => m.name);
    expect(methodNames).toEqual(['Widget', 'render', 'create']);

    const render = widget?.methods?.find((m) => m.name === 'render');
    expect(render?.signature.parameters).toEqual([
      { name: 'width', type: 'int' },
      { name: 'height', type: 'int' },
    ]);

    const create = widget?.methods?.find((m) => m.name === 'create');
    expect(create?.isStatic).toBe(true);
  });

  it('maps a struct with default-public methods', () => {
    const point = graph.exports.find((e) => e.name === 'Point');
    expect(point?.kind).toBe('struct');
    expect(point?.methods?.map((m) => m.name)).toEqual(['dist']);
  });

  it('maps enum class and using alias', () => {
    expect(graph.exports.find((e) => e.name === 'Mode')?.kind).toBe('enum');
    expect(graph.exports.find((e) => e.name === 'WidgetList')?.kind).toBe('type');
  });

  it('maps free functions inside a namespace', () => {
    const fn = graph.exports.find((e) => e.name === 'free_render');
    expect(fn?.kind).toBe('function');
    expect(fn?.signature?.returnType).toBe('void');
    expect(fn?.signature?.parameters).toEqual([{ name: 'w', type: 'const Widget&' }]);
  });

  it('handles a multi-line declaration with a default value', () => {
    const fn = graph.exports.find((e) => e.name === 'build_index');
    expect(fn?.kind).toBe('function');
    expect(fn?.signature?.returnType).toBe('std::map<std::string, int>');
    expect(fn?.signature?.parameters).toEqual([
      { name: 'names', type: 'const std::vector<std::string>&' },
      { name: 'case_sensitive', type: 'bool', optional: true },
    ]);
  });

  it('captures line anchors (1-based)', () => {
    const widget = graph.exports.find((e) => e.name === 'Widget');
    expect(widget?.line).toBe(13);
    expect(widget?.endLine).toBe(23);

    const mode = graph.exports.find((e) => e.name === 'Mode');
    expect(mode?.line).toBe(31);
    expect(mode?.endLine).toBe(34);

    const build = graph.exports.find((e) => e.name === 'build_index');
    expect(build?.line).toBe(40);
    expect(build?.endLine).toBe(42);
  });

  it('empty file produces an empty graph', () => {
    const out = mapCppFile('', 'src/empty.cpp');
    expect(out.exports).toEqual([]);
    expect(out.imports).toEqual([]);
  });
});

describe('mapCppFile — C source', () => {
  const graph = mapCppFile(C_FIXTURE, 'src/util.c');

  it('maps typedef struct/enum/function-pointer/simple', () => {
    expect(graph.exports.find((e) => e.name === 'Node')?.kind).toBe('struct');
    expect(graph.exports.find((e) => e.name === 'Color')?.kind).toBe('enum');
    expect(graph.exports.find((e) => e.name === 'Comparator')?.kind).toBe('type');
    expect(graph.exports.find((e) => e.name === 'count_t')?.kind).toBe('type');
  });

  it('maps function definitions and prototypes with signatures', () => {
    const count = graph.exports.find((e) => e.name === 'util_count');
    expect(count?.kind).toBe('function');
    expect(count?.signature?.returnType).toBe('int');
    expect(count?.signature?.parameters).toEqual([
      { name: 'text', type: 'const char*' },
      { name: 'needle', type: 'char' },
    ]);

    const strdup = graph.exports.find((e) => e.name === 'util_strdup');
    expect(strdup?.kind).toBe('function');
    expect(strdup?.signature?.returnType).toBe('char*');
  });

  it('skips static functions in a source file', () => {
    expect(graph.exports.map((e) => e.name)).not.toContain('internal_helper');
  });

  it('skips macros and content of strings/chars', () => {
    const names = graph.exports.map((e) => e.name);
    expect(names).not.toContain('MAX_LEN');
    expect(names).not.toContain('SQUARE');
    expect(names).not.toContain('MULTILINE');
    expect(names).not.toContain('do_something');
    expect(names).not.toContain('fake_from_string');
  });

  it('captures typedef line anchors', () => {
    const node = graph.exports.find((e) => e.name === 'Node');
    expect(node?.line).toBe(9);
    expect(node?.endLine).toBe(12);
  });
});

describe('mapCppFile — headers and edge cases', () => {
  it('keeps static inline functions in headers', () => {
    const out = mapCppFile(
      `#pragma once

static inline int clamp(int v, int lo, int hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}
`,
      'include/clamp.h',
    );
    const clamp = out.exports.find((e) => e.name === 'clamp');
    expect(clamp?.kind).toBe('function');
    expect(clamp?.line).toBe(3);
    expect(clamp?.endLine).toBe(5);
  });

  it('maps declarations inside extern "C" blocks', () => {
    const out = mapCppFile(
      `extern "C" {
void c_api_init(void);
int c_api_run(int argc, char** argv);
}
`,
      'src/api.cpp',
    );
    const init = out.exports.find((e) => e.name === 'c_api_init');
    expect(init?.kind).toBe('function');
    expect(init?.signature?.parameters).toEqual([]);
    const run = out.exports.find((e) => e.name === 'c_api_run');
    expect(run?.signature?.parameters).toEqual([
      { name: 'argc', type: 'int' },
      { name: 'argv', type: 'char**' },
    ]);
  });

  it('skips forward declarations, out-of-class definitions and qualified names', () => {
    const out = mapCppFile(
      `class Forward;
struct Fwd2;

void Widget::render(int w) {
  helper(w);
}

int g_counter = start_value();
`,
      'src/impl.cpp',
    );
    const names = out.exports.map((e) => e.name);
    expect(names).not.toContain('Forward');
    expect(names).not.toContain('Fwd2');
    expect(names).not.toContain('render');
    expect(names).not.toContain('Widget');
    expect(names).not.toContain('g_counter');
    expect(names).not.toContain('start_value');
  });

  it('ignores raw strings and digit separators', () => {
    const out = mapCppFile(
      `const char* sql = R"sql(
void fake_in_raw(int x);
)sql";

int big = 1'000'000;

int real_fn(void);
`,
      'src/raw.cpp',
    );
    const names = out.exports.map((e) => e.name);
    expect(names).toContain('real_fn');
    expect(names).not.toContain('fake_in_raw');
  });

  it('maps a template function and class', () => {
    const out = mapCppFile(
      `template <typename T>
T max_of(T a, T b) {
  return a > b ? a : b;
}

template <typename T>
class Box {
public:
  void put(T item);
};
`,
      'src/tmpl.hpp',
    );
    const fn = out.exports.find((e) => e.name === 'max_of');
    expect(fn?.kind).toBe('function');
    expect(fn?.line).toBe(1);
    expect(fn?.endLine).toBe(4);

    const box = out.exports.find((e) => e.name === 'Box');
    expect(box?.kind).toBe('class');
    expect(box?.methods?.map((m) => m.name)).toEqual(['put']);
  });
});
