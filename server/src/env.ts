export type Env = { Variables: { uid: number } }

export const APP_URL = (process.env.APP_URL ?? '').replace(/\/$/, '')
export const BOT_USERNAME = process.env.BOT_USERNAME ?? 'magnat_play_bot'
