import {
  ExtensionContext,
  Disposable,
  workspace,
} from 'vscode';
import { AllLineAnnotation, SelectionLineAnnotation } from './line-annotation';
import { isNil } from 'lodash';

class SubscriptionHandle {
  private disposable: Disposable | null = null;

  constructor (readonly ctx: ExtensionContext, private readonly onReload: () => Disposable | null) {
    this.reload();
  }

  reload () {
    if (!isNil(this.disposable)) {
      const index = this.ctx.subscriptions.indexOf(this.disposable);
      const disposable = this.ctx.subscriptions.splice(index, 1);
      disposable[0].dispose();
    }
    this.disposable = this.onReload();
    if (!isNil(this.disposable)) {
      this.ctx.subscriptions.push(this.disposable);
    }
  }
}

export function activate (context: ExtensionContext) {
  const lineAnnotation = new SubscriptionHandle(context, () => {
    const configs = workspace.getConfiguration('toLowercaseName');
    const annotation = configs.get<'disabled' | 'always' | 'selected'>('annotation');
    if (annotation === 'selected') {
      return new SelectionLineAnnotation();
    } else if (annotation === 'always') {
      return new AllLineAnnotation();
    }
    return null;
  });
  workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('toLowercaseName')) {
      lineAnnotation.reload();
    }
  });
}

export function deactivate () {}
