"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { actorOf, requireStaff } from "@/lib/staff";
import { audit, isUuid, sbInsert, sbPatch } from "@/lib/supabase";
import { randomKey, sha256Hex } from "@/lib/session";
import { KIOSK_COOKIE, KIOSK_MAX_AGE } from "@/lib/kiosk";
import { optStr, str } from "@/lib/admin";

export type DeviceState = { key?: string; name?: string; enabledHere?: boolean; error?: string };

// 新增讀卡站。mode=here：直接把這台瀏覽器設成讀卡站；mode=key：顯示金鑰給 ESP32 使用
export async function createDevice(_prev: DeviceState, fd: FormData): Promise<DeviceState> {
  const staff = await requireStaff(true);
  const name = str(fd, "name", 40);
  if (!name) return { error: "請幫讀卡站取個名字。" };
  const key = randomKey();
  const d = await sbInsert<{ id: string }>("devices", { name, room: optStr(fd, "room", 20), key_hash: await sha256Hex(key) });
  await audit(actorOf(staff), "device.create", `devices:${d.id}`, { name });
  revalidatePath("/admin/devices");
  if (str(fd, "mode", 5) === "here") {
    const jar = await cookies();
    jar.set(KIOSK_COOKIE, key, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: KIOSK_MAX_AGE,
    });
    return { name, enabledHere: true };
  }
  return { name, key };
}

export async function setDeviceActive(fd: FormData) {
  const staff = await requireStaff(true);
  const id = str(fd, "id", 40);
  if (!isUuid(id)) throw new Error("資料不正確");
  const active = str(fd, "active", 5) === "1";
  await sbPatch(`devices?id=eq.${id}`, { active });
  await audit(actorOf(staff), active ? "device.enable" : "device.disable", `devices:${id}`);
  revalidatePath("/admin/devices");
}

export async function updateDeviceRoom(fd: FormData) {
  const staff = await requireStaff(true);
  const id = str(fd, "id", 40);
  if (!isUuid(id)) throw new Error("資料不正確");
  await sbPatch(`devices?id=eq.${id}`, { room: optStr(fd, "room", 20), name: str(fd, "name", 40) || undefined });
  await audit(actorOf(staff), "device.update", `devices:${id}`);
  revalidatePath("/admin/devices");
}
