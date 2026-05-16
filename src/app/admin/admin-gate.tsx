"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AdminConsole } from "@/components/admin/admin-console";
import { fetchCurrentUser } from "@/lib/services";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function AdminGate() {
  const user = useQuery({ queryKey: ["me"], queryFn: fetchCurrentUser });

  if (user.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-sm text-text-muted">加载中</p>
      </main>
    );
  }

  if (!user.data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-4">
        <Card className="w-full max-w-sm p-6 text-center">
          <h1 className="text-base font-semibold text-text">需要登录</h1>
          <p className="mt-2 text-sm text-text-muted">请先登录后再访问管理后台。</p>
          <Button asChild className="mt-4 w-full">
            <Link href="/">返回登录</Link>
          </Button>
        </Card>
      </main>
    );
  }

  if (!user.data.isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-4">
        <Card className="w-full max-w-sm p-6 text-center">
          <h1 className="text-base font-semibold text-text">无权限访问</h1>
          <p className="mt-2 text-sm text-text-muted">当前账号不是管理员。如需访问，请联系系统管理员或使用 ADMIN_BOOTSTRAP_PHONE 配置。</p>
          <Button asChild variant="secondary" className="mt-4 w-full">
            <Link href="/">返回主页</Link>
          </Button>
        </Card>
      </main>
    );
  }

  return <AdminConsole />;
}
