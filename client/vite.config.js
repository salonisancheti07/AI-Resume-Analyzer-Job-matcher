import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiTarget = process.env.VITE_API_BASE_URL || "http://localhost:5000"
const aiTarget = process.env.VITE_AI_API_BASE_URL || "http://localhost:8000"

function sendProxyUnavailable(req, res, target) {
  const url = req?.url || ""
  const message = `Backend service unavailable at ${target}`

  if (res.headersSent) return

  if (url.startsWith("/api/auth/")) {
    res.writeHead(302, { Location: "/login?oauth=server_unavailable" })
    res.end()
    return
  }

  res.writeHead(503, { "Content-Type": "application/json" })
  res.end(JSON.stringify({ error: "backend_unavailable", message }))
}

function proxyConfig(target) {
  return {
    target,
    changeOrigin: true,
    configure(proxy) {
      proxy.on("error", (_error, req, res) => {
        sendProxyUnavailable(req, res, target)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/ai-chat": proxyConfig(aiTarget),
      "/api": proxyConfig(apiTarget),
    },
  },
})
