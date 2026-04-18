export type RecentJob = {
  id: string;
  kind: "transform" | "deployment";
  title: string;
  status: string;
  createdAt: string;
};
