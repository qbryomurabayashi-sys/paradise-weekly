import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {ErrorBoundary} from './components/ErrorBoundary';
import './index.css';

// iOS 15.3 以下向けの穴埋め。
// グラフ描画（recharts→es-toolkit）が Object.hasOwn / structuredClone を使っており、
// これが無い端末では店舗指標の分析タブを開いた瞬間にエラー画面になる。
// （どちらも Safari 15.4 から。Viteは構文だけ下げるのでランタイムAPIは補われない）
if (!(Object as any).hasOwn) {
  (Object as any).hasOwn = (o: any, k: any) => Object.prototype.hasOwnProperty.call(o, k);
}
if (typeof (globalThis as any).structuredClone !== 'function') {
  (globalThis as any).structuredClone = (v: any) => JSON.parse(JSON.stringify(v));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* 最外殻でも捕まえる。ここが無いと App/Login 本体の例外が白画面になり、
        iPhoneのホーム画面アプリでは再読み込み手段が無く復帰できない。 */}
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
