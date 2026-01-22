# Use the official Deno image (Alpine is smaller & faster)
FROM denoland/deno:alpine

# Set the working directory inside the container
WORKDIR /app

# Copy all files from the current directory (mothrbox_ts) into the container
COPY . .

# Cache dependencies (speeds up deployment)
# This downloads all the libraries imported in your main.ts
RUN deno cache src/main.ts

# Expose the port (Koyeb needs to know where to send traffic)
EXPOSE 3000

# Run the Hono server
# --allow-net: Required for Web Server + Walrus/Sui API calls
# --allow-env: Required to read SUI_SECRET_KEY, MONGO_URI
# --allow-read: Required to read files
CMD ["run", "--allow-net", "--allow-env", "--allow-read", "main.ts"]
