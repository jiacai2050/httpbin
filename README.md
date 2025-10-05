## [httpbin](https://github.com/jiacai2050/httpbin)

<p align="center">
  <img src="docs/logo.svg" />
</p>

A simple HTTP Request & Response Service, which is a great tool for testing HTTP libraries.

Inspired by [httpbin](https://httpbin.org), but built with Cloudflare Workers.

## Features

Support most of the endpoints in [httpbin](https://httpbin.org), including:

- HTTP methods
- Authentication
- Request inspection
- Response inspection
- Dynamic data
- Status codes
- Redirects
- Cookies
- Cache
- Anything

For all endpoints, we don't check the request method, so you can use any HTTP method to access any endpoint.

Besides, we have additional features not existing in the original httpbin, such as IP Geolocation:

```bash
curl https://httpbin.liujiacai.net/ip
```

Output:

```json
{
  "origin": "2408:8240:e10:947c:2806:6bb2:c222:343c",
  "continent": "AS",
  "latitude": "30.29365",
  "longitude": "120.16142",
  "country": "CN",
  "region": "Zhejiang",
  "regionCode": "ZJ",
  "city": "Hangzhou",
  "postalCode": "310000",
  "timezone": "Asia/Shanghai",
  "asn": 4837,
  "asOrganization": "China Unicom",
  "colo": "LAX"
}
```

### Frequently Used Endpoints

- `/get`: Returns GET data
- `/ip`: Reurns the requester's IP address
- `/ipgeo`: Returns the requester's IP address and geolocation information
- `/user-agent`: Returns the requester's User-Agent
- `/headers`: Returns the requester's HTTP headers
- `/status/:code`: Returns a response with the given status code
- `/anything`: Returns anything that was sent in the request
- `/delay/:n`: Delays responding for `n` seconds
- `/redirect/:n`: Redirects `n` times
- `/cookies`: Returns the requester's cookies
- `/cookies/set?name=value`: Sets a cookie
- `/basic-auth/:user/:passwd`: Challenges HTTP Basic Auth
- `/bearer`: Challenges HTTP Bearer Auth
- `/cache/:max-age`: Returns a response with `Cache-Control: public, max-age=60`
- `/response-headers?key=value`: Returns a response with the given headers
- `bytes/:n`: Returns `n` random bytes
- `/xml`: Returns a sample XML document
- `/html`: Returns a sample HTML document
- `/json`: Returns a sample JSON document
- `/gzip`: Returns a gzip-encoded response
- `/deflate`: Returns a deflate-encoded response
- `/anything/:anything`: Returns anything that was sent in the request
- `/image/:type`: Returns a random image of the given type (png, jpeg, webp, svg)

If you notice any endpoint missing or unexpected behavior, please [open an issue](https://github.com/jiacai2050/httpbin/issues) or [submit a pull request](https://github.com/jiacai2050/httpbin/pulls).

## Deploy

Anyone is welcome to deploy their own instance of httpbin. The free tier of Cloudflare Workers is sufficient for most use cases.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/jiacai2050/httpbin)

If you want to share your instance with others, please [let me know](https://github.com/jiacai2050/httpbin/discussions/4), I will add your instance to the list of public instances.

### Public Instances

| Instance                      | Maintainer                                   |
| ----------------------------- | -------------------------------------------- |
| https://httpbin.liujiacai.net | [@jiacai2050](https://github.com/jiacai2050) |


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
