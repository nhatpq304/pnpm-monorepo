// Mirrors nginx.conf: one entry per backend service, e.g.
// '/api/orders': { target: process.env.ORDERS_URL ?? 'http://localhost:3001', pathRewrite: { '^/api/orders': '' } }
export default {};
