export type ImageInput = {
    src: ImageMetadata | string;
    alt?: string;
};

export type Link = {
    href: string;
    text: string;
};

export type SocialLink = Link & {
    icon:
        | 'bluesky'
        | 'codepen'
        | 'dev'
        | 'facebook'
        | 'github'
        | 'instagram'
        | 'linkedin'
        | 'mastodon'
        | 'medium'
        | 'reddit'
        | 'x'
        | 'youtube'
        | 'bilibili'
        | 'zhihu'
        | 'xiaohongshu';
};

export type Hero = {
    title?: string;
    text?: string;
    avatar?: ImageInput;
    backgroundImage?: ImageInput;
};

export type SubscribeForm = {
    action: string;
    emailFieldName?: string;
    hiddenFields?: { name: string; value: string }[];
    honeypotFieldName?: string;
};

export type Subscribe = {
    enabled?: boolean;
    title?: string;
    text?: string;
    form?: SubscribeForm;
};

export type ForAgent = {
    enabled?: boolean;
    cardTitle?: string;
    cardText?: string;
    cardCta?: string;
    pageTitle?: string;
    pageIntro?: string;
    /** 短启动指令（用户复制后粘贴给 Agent，引导 Agent 读取 ai-subscription.md） */
    systemPrompt?: string;
    /** AI 订阅规则全文内容（Agent 通过 GET /for-agent/ai-subscription.md 读取，人类页面不展示） */
    agentProtocol?: string;
};

export type SiteConfig = {
    logo?: ImageInput;
    title: string;
    description: string;
    image?: ImageInput;
    primaryNavLinks?: Link[];
    secondaryNavLinks?: Link[];
    socialLinks?: SocialLink[];
    hero?: Hero;
    subscribe?: Subscribe;
    forAgent?: ForAgent;
    postsPerPage?: number;
};
