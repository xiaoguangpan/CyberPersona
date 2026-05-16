"use client";

import * as React from "react";
import { Eye, EyeOff, Lock, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { login, register } from "@/lib/services";

export function AuthScreen({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = React.useState("login");
  const [phone, setPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function submit() {
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login({ phone, password });
      } else {
        await register({ phone, password, confirmPassword });
      }
      onAuthed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen bg-bg">
      <section className="hidden flex-1 border-r border-border bg-bg-subtle px-10 py-12 lg:flex lg:flex-col lg:justify-between">
        <div>
          <div className="mb-12 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-bg text-sm font-semibold">
              CP
            </div>
            <span className="text-sm font-semibold text-text">CyberPersona</span>
          </div>
          <div className="max-w-md space-y-5">
            <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-text-subtle">
              CyberPersona
            </p>
            <h1 className="text-3xl font-semibold tracking-[-0.02em] text-text">
              打开即聊天，遇见你的 CyberPersona。
            </h1>
            <p className="text-sm leading-6 text-text-muted">
              登录后直接进入聊天。系统会为你生成专属角色、照片、声音和开场消息。
            </p>
          </div>
        </div>
        <div className="grid max-w-lg grid-cols-3 gap-3 text-xs text-text-muted">
          <Info title="专属角色" desc="每次分配都会生成独立性格、外貌和声音" />
          <Info title="多模态互动" desc="支持文字、语音、照片和表情包" />
          <Info title="关系记忆" desc="聊天、相册和角色信息会持续保留" />
        </div>
      </section>

      <section className="flex min-h-screen flex-1 items-center justify-center px-4 py-10">
        <Card className="w-full max-w-[400px] p-5">
          <div className="mb-6 space-y-2">
            <h2 className="text-2xl font-semibold tracking-[-0.02em] text-text">
              进入 CyberPersona
            </h2>
            <p className="text-sm text-text-muted">手机号和密码即可登录。</p>
          </div>

          <Tabs value={mode} onValueChange={setMode} className="space-y-5">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">登录</TabsTrigger>
              <TabsTrigger value="register">注册</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4">
              <FormFields
                phone={phone}
                password={password}
                confirmPassword={confirmPassword}
                showConfirm={false}
                showPassword={showPassword}
                onPhoneChange={setPhone}
                onPasswordChange={setPassword}
                onConfirmChange={setConfirmPassword}
                onToggleShow={() => setShowPassword((v) => !v)}
              />
            </TabsContent>
            <TabsContent value="register" className="space-y-4">
              <FormFields
                phone={phone}
                password={password}
                confirmPassword={confirmPassword}
                showConfirm
                showPassword={showPassword}
                onPhoneChange={setPhone}
                onPasswordChange={setPassword}
                onConfirmChange={setConfirmPassword}
                onToggleShow={() => setShowPassword((v) => !v)}
              />
            </TabsContent>
          </Tabs>

          {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

          <Button className="mt-5 w-full" size="lg" onClick={submit} disabled={loading}>
            {loading ? "处理中" : mode === "login" ? "登录并进入聊天" : "注册并进入聊天"}
          </Button>

          <p className="mt-4 text-center text-xs leading-5 text-text-subtle">
            登录后如果没有当前女友,将自动显示“正在为您分配女友”。
          </p>
        </Card>
      </section>
    </main>
  );
}

function FormFields(props: {
  phone: string;
  password: string;
  confirmPassword: string;
  showConfirm: boolean;
  showPassword: boolean;
  onPhoneChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onConfirmChange: (v: string) => void;
  onToggleShow: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="phone">手机号</Label>
        <div className="relative">
          <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
          <Input
            id="phone"
            value={props.phone}
            onChange={(event) => props.onPhoneChange(event.target.value)}
            className="pl-9"
            placeholder="请输入手机号"
            inputMode="tel"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">密码</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
          <Input
            id="password"
            value={props.password}
            onChange={(event) => props.onPasswordChange(event.target.value)}
            className="pl-9 pr-10"
            placeholder="请输入密码"
            type={props.showPassword ? "text" : "password"}
          />
          <button
            type="button"
            onClick={props.onToggleShow}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle"
            aria-label="显示密码"
          >
            {props.showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {props.showConfirm ? (
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">确认密码</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
            <Input
              id="confirmPassword"
              value={props.confirmPassword}
              onChange={(event) => props.onConfirmChange(event.target.value)}
              className="pl-9 pr-10"
              placeholder="再次输入密码"
              type={props.showPassword ? "text" : "password"}
            />
            <button
              type="button"
              onClick={props.onToggleShow}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle"
              aria-label="显示确认密码"
            >
              {props.showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Info({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg p-4">
      <p className="mb-1 font-medium text-text">{title}</p>
      <p className="leading-5">{desc}</p>
    </div>
  );
}
