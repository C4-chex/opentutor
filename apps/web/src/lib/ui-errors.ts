import { getLocale, uiText } from "./i18n";

export function localizeApiMessage(message: string, status?: number): string {
  if (getLocale() !== "zh") return message;
  const exact = uiText(message);
  if (exact !== message) return exact;
  if (/LECTOR.*experimental/i.test(message)) return "智能语义复习尚未启用，可先使用测验和闪卡复习。";
  if (/LOOM.*experimental/i.test(message)) return "实验性概念分析尚未启用。";
  if (/no api key configured/i.test(message)) return "尚未配置该模型服务的 API 密钥，请先在设置中填写。";
  if (/invalid api key|incorrect api key|authentication.*fail/i.test(message)) return "API 密钥校验失败，请检查密钥和服务商是否对应。";
  if (/insufficient.*(balance|quota)|insufficient_quota|balance.*insufficient/i.test(message)) return "模型服务余额或额度不足，请检查服务商账户。";
  if (/timed? ?out|timeout/i.test(message)) return "请求超时，请检查网络后重试。";
  if (/connection.*(refused|failed)|failed to fetch|networkerror/i.test(message)) return "无法连接服务，请检查网络与服务运行状态。";
  if (/[\u4e00-\u9fff]/.test(message)) return message;
  if (status === 401) return "身份验证失败，请检查登录状态或 API 密钥。";
  if (status === 402) return "模型服务余额或额度不足，请检查服务商账户。";
  if (status === 403) return "当前操作没有访问权限。";
  if (status === 404) return "未找到请求的内容，或该功能尚未启用。";
  if (status === 422) return "提交的内容不符合要求，请检查输入后重试。";
  if (status === 429) return "请求过于频繁，请稍后重试。";
  if (status === 502 || status === 503) return "服务暂时不可用，请稍后重试。";
  if (status && status >= 500) return "服务处理请求时出错，请稍后重试。";
  return message;
}
