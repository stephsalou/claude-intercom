FROM oven/bun:1

WORKDIR /app
COPY package.json ./
RUN bun install --production
COPY . .

EXPOSE 8787
CMD ["bun", "src/api/http.ts"]
