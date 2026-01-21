FROM denoland/deno:latest

WORKDIR /app

COPY deno.json ./
COPY src ./src

EXPOSE 8000

ENV PORT=8000

CMD ["deno", "run", "--allow-net", "--allow-read", "--allow-env", "--allow-write", "--allow-sys", "--env-file=.env", "src/walrus-cli.ts", "help"]
