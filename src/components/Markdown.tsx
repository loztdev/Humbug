import { type ReactNode, useState } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { theme } from '@/theme';

/**
 * A small, dependency-free Markdown renderer covering the subset that shows up
 * in chat: fenced code blocks (with a copy button), inline code, bold/italic,
 * links, headings, and bullet/numbered lists. Not a full CommonMark parser —
 * just enough to make assistant replies read correctly.
 */

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

type Segment = { type: 'code'; lang: string; text: string } | { type: 'text'; text: string };

function splitFences(src: string): Segment[] {
  const out: Segment[] = [];
  const re = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push({ type: 'text', text: src.slice(last, m.index) });
    out.push({ type: 'code', lang: m[1], text: m[2].replace(/\n$/, '') });
    last = re.lastIndex;
  }
  if (last < src.length) out.push({ type: 'text', text: src.slice(last) });
  return out.length ? out : [{ type: 'text', text: src }];
}

export function Markdown({ value, color }: { value: string; color?: string }) {
  const base = color ?? theme.colors.text;
  return (
    <View style={{ gap: theme.space(1.5) }}>
      {splitFences(value).map((seg, i) =>
        seg.type === 'code' ? (
          <CodeBlock key={i} text={seg.text} />
        ) : (
          <TextBlock key={i} text={seg.text} color={base} />
        ),
      )}
    </View>
  );
}

function CodeBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <View style={{ backgroundColor: '#0E0E14', borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.colors.border }}>
      <Pressable
        onPress={copy}
        style={{ position: 'absolute', right: 6, top: 6, zIndex: 1, backgroundColor: theme.colors.surfaceAlt, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}
      >
        <Text style={{ color: theme.colors.textDim, fontSize: 11 }}>{copied ? 'Copied ✓' : 'Copy'}</Text>
      </Pressable>
      <Text style={{ color: '#D6D6E0', fontFamily: MONO, fontSize: 13, padding: theme.space(3), paddingTop: theme.space(4) }}>
        {text}
      </Text>
    </View>
  );
}

function TextBlock({ text, color }: { text: string; color: string }) {
  const lines = text.replace(/\n{3,}/g, '\n\n').split('\n');
  return (
    <View>
      {lines.map((line, idx) => {
        if (line.trim() === '') return <View key={idx} style={{ height: 6 }} />;

        const h = line.match(/^(#{1,6})\s+(.*)/);
        if (h) {
          const size = h[1].length <= 1 ? 20 : h[1].length === 2 ? 18 : 16;
          return (
            <Text key={idx} style={{ color, fontSize: size, fontWeight: '700', marginTop: 4, marginBottom: 2 }}>
              {renderInline(h[2], color, `h${idx}`)}
            </Text>
          );
        }
        const bullet = line.match(/^\s*[-*]\s+(.*)/);
        if (bullet) {
          return (
            <Text key={idx} style={{ color, fontSize: 15, lineHeight: 22 }}>
              {'•  '}
              {renderInline(bullet[1], color, `b${idx}`)}
            </Text>
          );
        }
        const numbered = line.match(/^\s*(\d+)\.\s+(.*)/);
        if (numbered) {
          return (
            <Text key={idx} style={{ color, fontSize: 15, lineHeight: 22 }}>
              {`${numbered[1]}.  `}
              {renderInline(numbered[2], color, `n${idx}`)}
            </Text>
          );
        }
        return (
          <Text key={idx} style={{ color, fontSize: 15, lineHeight: 22 }}>
            {renderInline(line, color, `p${idx}`)}
          </Text>
        );
      })}
    </View>
  );
}

/** Inline span parser: **bold**, *italic*, `code`, [text](url). */
function renderInline(text: string, color: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  const push = (node: ReactNode) => nodes.push(node);
  while ((m = re.exec(text))) {
    if (m.index > last) push(<Text key={`${keyBase}-${k++}`} style={{ color }}>{text.slice(last, m.index)}</Text>);
    if (m[2] != null) push(<Text key={`${keyBase}-${k++}`} style={{ color, fontWeight: '700' }}>{m[2]}</Text>);
    else if (m[4] != null) push(<Text key={`${keyBase}-${k++}`} style={{ color, fontStyle: 'italic' }}>{m[4]}</Text>);
    else if (m[6] != null) push(<Text key={`${keyBase}-${k++}`} style={{ color: theme.colors.accent, fontFamily: MONO, fontSize: 13 }}>{m[6]}</Text>);
    else if (m[8] != null) {
      const url = m[9];
      push(
        <Text key={`${keyBase}-${k++}`} style={{ color: theme.colors.accent, textDecorationLine: 'underline' }} onPress={() => Linking.openURL(url)}>
          {m[8]}
        </Text>,
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) push(<Text key={`${keyBase}-${k++}`} style={{ color }}>{text.slice(last)}</Text>);
  return nodes;
}
