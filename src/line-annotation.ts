import {
  window as vWin,
  Disposable,
  TextEditor,
  DecorationRangeBehavior,
  ThemeColor,
  Range,
  DecorationOptions,
  workspace,
  TextDocument,
} from 'vscode';
import { isNil, isNumber, range } from 'lodash';

const annotationDecoration = vWin.createTextEditorDecorationType({
  after: {
    margin: '0 0 0 1.5em',
    textDecoration: 'none',
  },
  rangeBehavior: DecorationRangeBehavior.ClosedOpen,
});

type WorkTextEditor = Branded<TextEditor, 'WorkTextEditor'>;

export abstract class LineAnnotation implements Disposable {
  protected _disposable: Disposable;
  constructor () {
    this._disposable = Disposable.from(
      workspace.onDidChangeTextDocument(() => {
        if (this.isTextEditor(vWin.activeTextEditor)) {
          this.refreshEditor(vWin.activeTextEditor);
        }
      }),
    );
    vWin.visibleTextEditors.forEach((editor) => {
      if (this.isTextEditor(editor)) {
        this.refreshEditor(editor);
      }
    });
  }

  abstract refreshEditor (editor: WorkTextEditor): void;

  isTextEditor (editor?: TextEditor): editor is WorkTextEditor {
    if (isNil(editor)) {
      return false;
    }
    const scheme = editor.document.uri.scheme;
    return scheme !== 'output' && scheme !== 'debug';
  }

  getLineText (source: string) {
    const configs = workspace.getConfiguration('toLowercaseName');
    const maxLengthOfLine = configs.get<number>('maxLengthOfLine');
    if (isNumber(maxLengthOfLine) && source.length > maxLengthOfLine) {
      return null;
    }
    const regexp = new RegExp(configs.get<string>('marchRegExp') ?? '[A-Z]{3,}', 'g');
    const list = [...source.matchAll(regexp)].map((item) => item[0].toLowerCase());
    return list.length > 0 ? list.join(', ') : null;
  }

  getLineDecoration (document: TextDocument, line: number): DecorationOptions | null {
    const source = document.lineAt(line).text.trim();
    if (source.length === 0) {
      return null;
    }
    const result = this.getLineText(source);
    if (isNil(result)) {
      return null;
    }
    return {
      renderOptions: {
        after: {
          backgroundColor: new ThemeColor('extension.toLowercaseName.annotationBackgroundColor'),
          color: new ThemeColor('extension.toLowercaseName.annotationForegroundColor'),
          contentText: result,
        },
      },
      range: document.validateRange(new Range(line, Number.MAX_SAFE_INTEGER, line, Number.MAX_SAFE_INTEGER)),
    };
  }

  dispose () {
    this._disposable.dispose();
    vWin.visibleTextEditors.forEach((editor) => {
      if (this.isTextEditor(editor)) {
        editor.setDecorations(annotationDecoration, []);
      }
    });
  }
}

export class SelectionLineAnnotation extends LineAnnotation {
  constructor () {
    super();
    const parentDisposable = this._disposable;
    this._disposable = Disposable.from(
      parentDisposable,
      vWin.onDidChangeTextEditorSelection((event) => {
        if (this.isTextEditor(event.textEditor)) {
          this.refreshEditor(event.textEditor);
        }
      }),
    );
  }

  refreshEditor (editor: WorkTextEditor) {
    const lines = Array.from(this.getLines(editor));
    const decorations: DecorationOptions[] = [];
    for (const line of lines) {
      const decoration = this.getLineDecoration(editor.document, line);
      if (isNil(decoration)) {
        continue;
      } else {
        decorations.push(decoration);
      }
    }
    editor.setDecorations(annotationDecoration, decorations);
  }

  getLines (editor: WorkTextEditor) {
    return new Set(editor.selections.map((s) => ({ start: s.start.line, end: s.end.line })).reduce((lines, s) => (lines.push(...range(s.start, s.end + 1)), lines), [] as number[]));
  }
}

export class AllLineAnnotation extends LineAnnotation {
  constructor () {
    super();
    const parentDisposable = this._disposable;
    this._disposable = Disposable.from(
      parentDisposable,
      vWin.onDidChangeVisibleTextEditors((editors) => {
        editors.forEach((editor) => {
          if (this.isTextEditor(editor)) {
            this.refreshEditor(editor);
          }
        });
      }),
      vWin.onDidChangeTextEditorVisibleRanges((event) => {
        if (this.isTextEditor(event.textEditor)) {
          this.refreshEditor(event.textEditor);
        }
      }),
    );
  }

  refreshEditor (editor: WorkTextEditor) {
    const lines = Array.from(this.getLines(editor));
    const decorations: DecorationOptions[] = [];
    for (const line of lines) {
      const decoration = this.getLineDecoration(editor.document, line);
      if (isNil(decoration)) {
        continue;
      } else {
        decorations.push(decoration);
      }
    }
    editor.setDecorations(annotationDecoration, decorations);
  }

  getLines (editor: WorkTextEditor) {
    return new Set(editor.visibleRanges.map((s) => ({ start: s.start.line, end: s.end.line })).reduce((lines, s) => (lines.push(...range(s.start, s.end + 1)), lines), [] as number[]));
  }
}
