import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js/lib/core';
import python from 'highlight.js/lib/languages/python';

hljs.registerLanguage('python', python);

export function createMarkdown() {
    const markdown = new MarkdownIt({
        highlight(code, language) {
            if (!['python', 'py', 'python3'].includes(language.toLowerCase())) return '';
            return hljs.highlight(code, { language: 'python' }).value;
        }
    });

    // Markdown tables use bare <br> tags for line breaks inside a cell.
    markdown.inline.ruler.before('html_inline', 'line_break_tag', (state, silent) => {
        if (state.src[state.pos] !== '<') return false;
        const match = /^<br[ \t]*\/?>/i.exec(state.src.slice(state.pos));
        if (!match) return false;
        if (!silent) state.push('hardbreak', 'br', 0);
        state.pos += match[0].length;
        return true;
    });

    markdown.renderer.rules.table_open = () => '<div class="markdown-table" tabindex="0" role="region" aria-label="Table"><table>';
    markdown.renderer.rules.table_close = () => '</table></div>\n';
    return markdown;
}
