## httpbin

A simple HTTP Request & Response Service, which is a great tool for testing HTTP libraries.

Inspired by [httpbin](https://httpbin.org), but built with Cloudflare Workers.

## Deployment

Everyone can deploy their own instance of httpbin to Cloudflare Workers with one click.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/jiacai2050/httpbin)

A free hosted instance is available at https://httpbin.liujiacai.net

## Development

```bash
# clone the repo and install dependencies
git clone https://github.com/jiacai2050/httpbin.git && cd httpbin
npm install

# start development server, listen on http://localhost:8787
npm run dev

# Deploy to Cloudflare Workers
# Make sure to set up your Cloudflare Workers environment first
# https://developers.cloudflare.com/workers/get-started/guide/
npm run deploy
```

## License
[MIT License](LICENSE)
