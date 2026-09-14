import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 5310;

  // JSON body parser with a slightly larger limit for large text blocks
  app.use(express.json({ limit: "10mb" }));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static file serving
    const distPath = path.join(process.cwd(), "dist");

    // 1) ハッシュ付き成果物は1年 immutable。
    //    fallthrough:false が重要：存在しないハッシュのJSを要求されたときに
    //    下のSPAフォールバックへ落として index.html(text/html) を返すと、
    //    ES module のMIME判定に失敗して iOS Safari が真っ白になる（デプロイ後の「開かない」の主因）。
    app.use(
      "/assets",
      express.static(path.join(distPath, "assets"), {
        immutable: true,
        maxAge: "1y",
        index: false,
        fallthrough: false,
      })
    );

    // 2) その他の静的ファイル。バージョン判定用のjsonはキャッシュさせない。
    app.use(
      express.static(distPath, {
        index: false,
        setHeaders: (res, filePath) => {
          if (/(version|manifest)\.json$/.test(filePath)) {
            res.setHeader("Cache-Control", "no-store");
          } else {
            res.setHeader("Cache-Control", "public, max-age=3600");
          }
        },
      })
    );

    // 3) SPAフォールバック。index.html は絶対にキャッシュさせない
    //    （古いindex.htmlが残ると、消えたハッシュのJSを取りに行って白画面になる）。
    app.get("*", (_req, res) => {
      res.set({
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      });
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
