import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createLineBuffer,
  parseStreamEvent,
  streamWithClaude,
  type AssistantEvent,
  type ResultEvent,
  type SystemInitEvent,
  type UnknownEvent,
  type UserEvent,
} from './stream.js';

// Mock spawnu pro testy `streamWithClaude` — parser testy ho neaktivují
// (parseStreamEvent na child_process nesahá), takže mock je inertní pro
// většinu suite a hraje roli jen v posledním describe bloku.
const spawnMock = vi.fn();
vi.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

describe('parseStreamEvent', () => {
  it('vrací null pro prázdnou řádku', () => {
    expect(parseStreamEvent('')).toBeNull();
  });

  it('vrací null pro řádku obsahující jen bílé znaky', () => {
    expect(parseStreamEvent('   \t  ')).toBeNull();
  });

  it('hází výjimku pro nevalidní JSON', () => {
    expect(() => parseStreamEvent('{not json')).toThrow();
  });

  describe('system + init envelope', () => {
    it('mapuje model, tools, cwd a sessionId', () => {
      const line = JSON.stringify({
        type: 'system',
        subtype: 'init',
        session_id: 'sess-abc',
        model: 'claude-opus-4-7',
        tools: ['Read', 'Write', 'Bash'],
        cwd: '/tmp/proj',
      });

      const event = parseStreamEvent(line) as SystemInitEvent;

      expect(event.kind).toBe('system-init');
      expect(event.sessionId).toBe('sess-abc');
      expect(event.model).toBe('claude-opus-4-7');
      expect(event.tools).toEqual(['Read', 'Write', 'Bash']);
      expect(event.cwd).toBe('/tmp/proj');
      expect(event.raw).toMatchObject({ type: 'system', subtype: 'init' });
    });

    it('vyfiltruje z tools nestringové položky', () => {
      const line = JSON.stringify({
        type: 'system',
        subtype: 'init',
        tools: ['Read', 42, null, 'Write'],
      });

      const event = parseStreamEvent(line) as SystemInitEvent;

      expect(event.kind).toBe('system-init');
      expect(event.tools).toEqual(['Read', 'Write']);
    });

    it('vrací undefined pro chybějící volitelná pole', () => {
      const line = JSON.stringify({ type: 'system', subtype: 'init' });

      const event = parseStreamEvent(line) as SystemInitEvent;

      expect(event.kind).toBe('system-init');
      expect(event.model).toBeUndefined();
      expect(event.tools).toBeUndefined();
      expect(event.cwd).toBeUndefined();
      expect(event.sessionId).toBeUndefined();
    });

    it('system s jiným subtypem než init je unknown', () => {
      const line = JSON.stringify({ type: 'system', subtype: 'shutdown' });

      const event = parseStreamEvent(line) as UnknownEvent;

      expect(event.kind).toBe('unknown');
      expect(event.type).toBe('system');
    });
  });

  describe('assistant envelope', () => {
    it('rozdělí obsah na textové části a tool_use volání', () => {
      const line = JSON.stringify({
        type: 'assistant',
        session_id: 'sess-1',
        message: {
          content: [
            { type: 'text', text: 'Začínám práci.' },
            {
              type: 'tool_use',
              id: 'tu_1',
              name: 'Read',
              input: { file_path: '/foo' },
            },
            { type: 'text', text: 'Hotovo.' },
          ],
        },
      });

      const event = parseStreamEvent(line) as AssistantEvent;

      expect(event.kind).toBe('assistant');
      expect(event.sessionId).toBe('sess-1');
      expect(event.textParts).toEqual(['Začínám práci.', 'Hotovo.']);
      expect(event.toolUses).toEqual([
        { id: 'tu_1', name: 'Read', input: { file_path: '/foo' } },
      ]);
    });

    it('ignoruje textové bloky bez stringového text pole', () => {
      const line = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 42 },
            { type: 'text' },
            { type: 'text', text: 'ok' },
          ],
        },
      });

      const event = parseStreamEvent(line) as AssistantEvent;

      expect(event.textParts).toEqual(['ok']);
    });

    it('tool_use bez name dostane fallback "(unknown)"', () => {
      const line = JSON.stringify({
        type: 'assistant',
        message: {
          content: [{ type: 'tool_use', id: 'tu_x' }],
        },
      });

      const event = parseStreamEvent(line) as AssistantEvent;

      expect(event.toolUses).toEqual([
        { id: 'tu_x', name: '(unknown)', input: undefined },
      ]);
    });

    it('přežije chybějící message i prázdné content', () => {
      const noMsg = parseStreamEvent(
        JSON.stringify({ type: 'assistant' }),
      ) as AssistantEvent;
      expect(noMsg.kind).toBe('assistant');
      expect(noMsg.textParts).toEqual([]);
      expect(noMsg.toolUses).toEqual([]);

      const emptyContent = parseStreamEvent(
        JSON.stringify({ type: 'assistant', message: { content: [] } }),
      ) as AssistantEvent;
      expect(emptyContent.textParts).toEqual([]);
      expect(emptyContent.toolUses).toEqual([]);
    });

    it('ignoruje bloky nestandardních typů a nestrukturované položky', () => {
      const line = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            null,
            'string-blok',
            { type: 'image', source: {} },
            { type: 'text', text: 'jediný validní' },
          ],
        },
      });

      const event = parseStreamEvent(line) as AssistantEvent;

      expect(event.textParts).toEqual(['jediný validní']);
      expect(event.toolUses).toEqual([]);
    });
  });

  describe('user envelope', () => {
    it('extrahuje tool_result včetně is_error a stringového preview', () => {
      const line = JSON.stringify({
        type: 'user',
        session_id: 'sess-2',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tu_1',
              is_error: false,
              content: 'výsledek běhu',
            },
          ],
        },
      });

      const event = parseStreamEvent(line) as UserEvent;

      expect(event.kind).toBe('user');
      expect(event.sessionId).toBe('sess-2');
      expect(event.toolResults).toEqual([
        {
          toolUseId: 'tu_1',
          isError: false,
          contentPreview: 'výsledek běhu',
        },
      ]);
    });

    it('zkrátí dlouhé stringové preview na 200 znaků s elipsou', () => {
      const longText = 'a'.repeat(500);
      const line = JSON.stringify({
        type: 'user',
        message: {
          content: [
            { type: 'tool_result', tool_use_id: 't', content: longText },
          ],
        },
      });

      const event = parseStreamEvent(line) as UserEvent;
      const preview = event.toolResults[0]!.contentPreview!;

      expect(preview).toHaveLength(201); // 200 znaků + elipsa
      expect(preview.endsWith('…')).toBe(true);
      expect(preview.startsWith('a'.repeat(200))).toBe(true);
    });

    it('vytáhne první textový blok když content je pole', () => {
      const line = JSON.stringify({
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 't',
              content: [
                { type: 'image', source: {} },
                { type: 'text', text: 'první text' },
                { type: 'text', text: 'druhý text' },
              ],
            },
          ],
        },
      });

      const event = parseStreamEvent(line) as UserEvent;

      expect(event.toolResults[0]!.contentPreview).toBe('první text');
    });

    it('vrací undefined preview když pole nemá žádný textový blok', () => {
      const line = JSON.stringify({
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 't',
              content: [{ type: 'image', source: {} }],
            },
          ],
        },
      });

      const event = parseStreamEvent(line) as UserEvent;

      expect(event.toolResults[0]!.contentPreview).toBeUndefined();
    });

    it('vrací undefined preview pro neznámý typ content', () => {
      const line = JSON.stringify({
        type: 'user',
        message: {
          content: [
            { type: 'tool_result', tool_use_id: 't', content: 42 },
          ],
        },
      });

      const event = parseStreamEvent(line) as UserEvent;

      expect(event.toolResults[0]!.contentPreview).toBeUndefined();
    });

    it('ignoruje bloky které nejsou tool_result', () => {
      const line = JSON.stringify({
        type: 'user',
        message: {
          content: [
            { type: 'text', text: 'jen poznámka' },
            { type: 'tool_result', tool_use_id: 't', content: 'OK' },
          ],
        },
      });

      const event = parseStreamEvent(line) as UserEvent;

      expect(event.toolResults).toHaveLength(1);
      expect(event.toolResults[0]!.toolUseId).toBe('t');
    });
  });

  describe('result envelope', () => {
    it('mapuje cenu, usage a metadata', () => {
      const line = JSON.stringify({
        type: 'result',
        session_id: 'sess-3',
        total_cost_usd: 0.1234,
        duration_ms: 4321,
        num_turns: 5,
        result: 'hotovo',
        is_error: false,
        usage: {
          input_tokens: 100,
          output_tokens: 200,
          cache_read_input_tokens: 50,
          cache_creation_input_tokens: 25,
        },
      });

      const event = parseStreamEvent(line) as ResultEvent;

      expect(event.kind).toBe('result');
      expect(event.sessionId).toBe('sess-3');
      expect(event.costUsd).toBe(0.1234);
      expect(event.durationMs).toBe(4321);
      expect(event.numTurns).toBe(5);
      expect(event.resultText).toBe('hotovo');
      expect(event.isError).toBe(false);
      expect(event.usage).toEqual({
        inputTokens: 100,
        outputTokens: 200,
        cacheReadTokens: 50,
        cacheCreationTokens: 25,
      });
    });

    it('vyplní v usage 0 pro chybějící hodnoty', () => {
      const line = JSON.stringify({
        type: 'result',
        usage: { input_tokens: 7 },
      });

      const event = parseStreamEvent(line) as ResultEvent;

      expect(event.usage).toEqual({
        inputTokens: 7,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
      });
    });

    it('result bez usage má usage undefined', () => {
      const line = JSON.stringify({ type: 'result', total_cost_usd: 0 });

      const event = parseStreamEvent(line) as ResultEvent;

      expect(event.usage).toBeUndefined();
      expect(event.costUsd).toBe(0);
    });

    it('zachází s isError=true jako s chybou', () => {
      const line = JSON.stringify({
        type: 'result',
        is_error: true,
        result: 'něco se rozbilo',
      });

      const event = parseStreamEvent(line) as ResultEvent;

      expect(event.isError).toBe(true);
      expect(event.resultText).toBe('něco se rozbilo');
    });
  });

  describe('unknown a degradované envelopy', () => {
    it('vrací unknown pro neznámý type', () => {
      const line = JSON.stringify({ type: 'foobar', session_id: 's' });

      const event = parseStreamEvent(line) as UnknownEvent;

      expect(event.kind).toBe('unknown');
      expect(event.type).toBe('foobar');
      expect(event.raw).toMatchObject({ type: 'foobar' });
    });

    it('vrací unknown s prázdným type když type chybí', () => {
      const line = JSON.stringify({ foo: 'bar' });

      const event = parseStreamEvent(line) as UnknownEvent;

      expect(event.kind).toBe('unknown');
      expect(event.type).toBe('');
    });

    it('ignoruje session_id, který není string', () => {
      const line = JSON.stringify({
        type: 'assistant',
        session_id: 12345,
        message: { content: [] },
      });

      const event = parseStreamEvent(line) as AssistantEvent;

      expect(event.sessionId).toBeUndefined();
    });
  });
});

describe('createLineBuffer', () => {
  it('emituje jednu kompletní řádku z jednoho chunku', () => {
    const lines: string[] = [];
    const buf = createLineBuffer((l) => lines.push(l));

    buf.push('jedna řádka\n');

    expect(lines).toEqual(['jedna řádka']);
  });

  it('emituje více řádek z jednoho chunku', () => {
    const lines: string[] = [];
    const buf = createLineBuffer((l) => lines.push(l));

    buf.push('a\nb\nc\n');

    expect(lines).toEqual(['a', 'b', 'c']);
  });

  it('nedokončenou řádku neemituje dokud nedorazí newline', () => {
    const lines: string[] = [];
    const buf = createLineBuffer((l) => lines.push(l));

    buf.push('část ');
    buf.push('řádky');

    expect(lines).toEqual([]);

    buf.push('\n');

    expect(lines).toEqual(['část řádky']);
  });

  it('správně spojuje data rozdělená uprostřed JSON envelope', () => {
    const lines: string[] = [];
    const buf = createLineBuffer((l) => lines.push(l));

    const envelope = JSON.stringify({ type: 'result', total_cost_usd: 0.05 });
    const mid = Math.floor(envelope.length / 2);

    buf.push(envelope.slice(0, mid));
    buf.push(`${envelope.slice(mid)}\n`);

    expect(lines).toEqual([envelope]);
    // Pro jistotu: rozdělené řádky se dají zpětně sparsovat.
    const event = parseStreamEvent(lines[0]!) as ResultEvent;
    expect(event.kind).toBe('result');
    expect(event.costUsd).toBe(0.05);
  });

  it('prázdné řádky emituje jako prázdný string', () => {
    const lines: string[] = [];
    const buf = createLineBuffer((l) => lines.push(l));

    buf.push('\n\nx\n');

    expect(lines).toEqual(['', '', 'x']);
  });

  it('flush() vyemituje zbývající nedokončený řádek', () => {
    const lines: string[] = [];
    const buf = createLineBuffer((l) => lines.push(l));

    buf.push('řádka bez konce');
    buf.flush();

    expect(lines).toEqual(['řádka bez konce']);
  });

  it('flush() bez zbytku nic neemituje', () => {
    const lines: string[] = [];
    const buf = createLineBuffer((l) => lines.push(l));

    buf.push('plně ukončená\n');
    lines.length = 0;
    buf.flush();

    expect(lines).toEqual([]);
  });

  it('opakovaný flush() po vyprázdnění už nic neemituje', () => {
    const lines: string[] = [];
    const buf = createLineBuffer((l) => lines.push(l));

    buf.push('zbytek');
    buf.flush();
    buf.flush();

    expect(lines).toEqual(['zbytek']);
  });

  it('zvládne CRLF — \\r zůstane součástí řádky', () => {
    // Buffer rozděluje jen podle \n, takže \r se nezahodí. Tohle zafixuje chování,
    // aby případná budoucí změna nezpůsobila tichou regresi.
    const lines: string[] = [];
    const buf = createLineBuffer((l) => lines.push(l));

    buf.push('a\r\nb\n');

    expect(lines).toEqual(['a\r', 'b']);
  });
});

// Minimalistická náhrada za reálný ChildProcess. Stream code potřebuje
// `stdout`/`stderr` s `setEncoding` a `on('data', ...)` a samotný proces
// s `on('error'|'close', ...)`. EventEmitter dává obě věci zadarmo.
class FakeStdio extends EventEmitter {
  setEncoding = vi.fn();
}
class FakeChildProcess extends EventEmitter {
  stdout = new FakeStdio();
  stderr = new FakeStdio();
}

function captureSpawnArgs(): string[] {
  const call = spawnMock.mock.calls[0];
  if (!call) throw new Error('spawn nebyl zavolán');
  return call[1] as string[];
}

describe('streamWithClaude — sestavení argumentů spawnu', () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  it('přidá `--max-turns N` do args když je opts.maxTurns zadané', async () => {
    const proc = new FakeChildProcess();
    spawnMock.mockReturnValue(proc);

    const promise = streamWithClaude('test prompt', { maxTurns: 3 });
    // Necháme čistou cestu — žádný stdout, žádný stderr, hned ukončíme.
    proc.emit('close', 0);
    const result = await promise;

    expect(result.exitCode).toBe(0);
    expect(spawnMock).toHaveBeenCalledTimes(1);
    const args = captureSpawnArgs();
    const idx = args.indexOf('--max-turns');
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(args[idx + 1]).toBe('3');
    // Hodnota musí přijít před `--` separátorem promptu, jinak by ji
    // claude bral jako součást promptu.
    const sepIdx = args.indexOf('--');
    expect(sepIdx).toBeGreaterThan(idx + 1);
  });

  it('nepřidá `--max-turns` když opts.maxTurns chybí', async () => {
    const proc = new FakeChildProcess();
    spawnMock.mockReturnValue(proc);

    const promise = streamWithClaude('test prompt');
    proc.emit('close', 0);
    await promise;

    const args = captureSpawnArgs();
    expect(args).not.toContain('--max-turns');
  });

  it('předá `--max-turns` jako string i pro velké hodnoty', async () => {
    const proc = new FakeChildProcess();
    spawnMock.mockReturnValue(proc);

    const promise = streamWithClaude('p', { maxTurns: 123 });
    proc.emit('close', 0);
    await promise;

    const args = captureSpawnArgs();
    const idx = args.indexOf('--max-turns');
    expect(args[idx + 1]).toBe('123');
    // Žádná z hodnot v args nesmí být číslo (spawn vyžaduje stringy).
    for (const a of args) {
      expect(typeof a).toBe('string');
    }
  });

  it('flag kombinuje s ostatními opts (model, permissionMode, allowedTools)', async () => {
    const proc = new FakeChildProcess();
    spawnMock.mockReturnValue(proc);

    const promise = streamWithClaude('p', {
      maxTurns: 2,
      model: 'claude-opus-4-7',
      permissionMode: 'acceptEdits',
      allowedTools: ['Read', 'Write'],
    });
    proc.emit('close', 0);
    await promise;

    const args = captureSpawnArgs();
    expect(args).toContain('--max-turns');
    expect(args).toContain('2');
    expect(args).toContain('--model');
    expect(args).toContain('claude-opus-4-7');
    expect(args).toContain('--permission-mode');
    expect(args).toContain('acceptEdits');
    expect(args).toContain('--allowed-tools');
    expect(args).toContain('Read,Write');
  });
});
