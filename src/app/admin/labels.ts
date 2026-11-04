// 後台用的中文標籤
export const LEAD_STATUSES = [
  { value: "new", label: "新詢問", color: "red" },
  { value: "contacted", label: "已聯絡", color: "yellow" },
  { value: "trial_booked", label: "已約試聽", color: "blue" },
  { value: "enrolled", label: "已報名", color: "green" },
  { value: "closed", label: "結案", color: "gray" },
] as const;

export const LEAD_TYPES: Record<string, string> = {
  trial: "預約試聽",
  workshop: "活動／工作坊",
  school: "學校合作",
  other: "其他",
};
