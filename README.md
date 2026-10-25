# Runlayer — pilots

1 working pilot built for Runlayer.

### MCP server review report

Paste an MCP server's tools/list response and the security review comes back \u2014 infra-ops is 9 tools, 1 of them able to send data out and 1 destructive, with run_command accepting a shell string and delete_cluster declaring itself read-only, so the verdict is reject and the policy it implies is written out tool by tool.

`companies/runlayer/runlayer-mcp-review-report/`

## Running it

```bash
npm install
npm run dev
```

One or more of these pilots keeps state in Postgres. Set `DATABASE_URL` in `.env.local`, then `npm run db:seed`.

## Note on the data

Every figure in these pilots is synthetic and labelled as such in the interface.
Nothing here is connected to Runlayer's systems, and no number should be
read as a measurement of their business.
