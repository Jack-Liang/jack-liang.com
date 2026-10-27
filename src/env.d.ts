/// <reference types="astro/client" />

// Workers 运行时内置模块；这里只声明项目用到的最小面，供 astro check 使用
declare module 'cloudflare:workers' {
    export const env: Record<string, unknown>;
}
