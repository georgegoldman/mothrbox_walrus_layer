# Use the official Deno image
FROM denoland/deno:alpine

WORKDIR /app

# Copy all files from the current directory
COPY . .

# ✅ FIX 1: Point to src/main.ts (not just main.ts)
RUN deno cache src/main.ts

# Expose port 3000
EXPOSE 3000

# ✅ FIX 2: Run the file from the src folder
CMD ["run", "--allow-net", "--allow-env", "--allow-read", "src/main.ts"]
