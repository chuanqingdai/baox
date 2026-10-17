export const ROLES = {
  member: "普通会员",
  angel: "AI大师天使群",
  team: "团队内部成员",
};
export const PAGES = {
  masterclass: "AI大师课",
  poster: "展页",
  collection: "保藏",
  tool: "工具包",
  about: "关于我们",
  activity: "活动量跟踪仪",
  zhibo: "直播神器",
  zx202610: "万相臻选2026年10月",
  "2026syx": "2026王牌税优产品",
  information: "客户信息",
};
export const DEFAULT_PUBLIC = Object.keys(PAGES).filter(
  (page) => page !== "collection",
);
export function safeNext(value) {
  if (
    typeof value !== "string" ||
    !/^\/(?!\/)[a-zA-Z0-9/_-]*(?:#[\w-]*)?$/.test(value)
  )
    return "/account/";
  return value.startsWith("/api/") ? "/account/" : value;
}
