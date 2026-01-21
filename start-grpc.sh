#!/bin/bash
deno run --allow-net --allow-read --allow-env --allow-write --allow-sys --env-file src/grpc-server.ts 2>&1 | grep -v "ERR_HTTP2_SOCKET_UNBOUND"