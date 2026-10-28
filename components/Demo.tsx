"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { ROLE_LABEL } from "@/lib/types";
import { Field, Icon, Modal } from "./ui";

export const FEEDBACK_TG = "halifaevmg";

const SECTION: Record<string, string> = {
  "/": "Журнал",
  "/brides": "Редактор · Невесты",
  "/records": "Книга записей",
  "/dresses": "Редактор · Платья",
  "/cleaning": "Редактор · Химчистка",
  "/timesheet": "Табель",
  "/staff": "Сотрудники",
  "/reports": "Отчёты",
};

/** Плашка демо-версии над содержимым страницы */
export function DemoBar() {
  const { db, can, openDialog, clearAll, toast } = useStore();
  return (
    <div className="demo-bar" role="note">
      <span className="demo-tag">Демо</span>
      <span className="demo-text">
        Тестовая версия. Не вводите реальные паспортные данные.
        {db.demo && " Сейчас в базе пример данных."}
      </span>
      {db.demo && can("reports") && (
        <button
          type="button"
          className="link-btn small"
          onClick={() => {
            clearAll();
            toast("Пример удалён, база пустая");
          }}
        >
          Очистить пример
        </button>
      )}
      <button type="button" className="btn btn-small demo-feedback" onClick={() => openDialog({ kind: "feedback" })}>
        <Icon name="chat" size={16} /> Замечание
      </button>
    </div>
  );
}

/** Подсказка владельцу на пустой базе */
export function EmptyDbHint() {
  const { db, can, fillDemo, toast } = useStore();
  if (!can("reports") || db.visits.length || db.bookings.length || db.items.length) return null;
  return (
    <div className="callout callout-info empty-db">
      <Icon name="book" size={18} />
      <span>
        База пустая. Можно начать работу с нуля: добавить платья в разделе «Редактор → Платья» и записывать невест. Или заполнить CRM примером за год работы салона, чтобы посмотреть, как выглядят журнал и отчёты. Пример потом удаляется одной кнопкой.
      </span>
      <button
        type="button"
        className="btn btn-small"
        onClick={() => {
          const err = fillDemo();
          toast(err ?? "Готово: в базе пример за год работы салона");
        }}
      >
        Заполнить примером
      </button>
    </div>
  );
}

export function FeedbackForm({ onClose }: { onClose: () => void }) {
  const { user } = useStore();
  const path = usePathname();
  const section = SECTION[path] ?? path;
  const [text, setText] = useState("");
  const [copied, setCopied] = useState<"yes" | "no" | null>(null);
  const message = `Lori CRM — замечание\nРаздел: ${section}\nРоль: ${user ? ROLE_LABEL[user.role] : "—"}${user && user.name !== ROLE_LABEL[user.role] ? ` (${user.name})` : ""}\nУстройство: ${typeof window !== "undefined" && window.innerWidth < 900 ? "телефон" : "компьютер"}\n\n${text.trim()}`;

  const send = async () => {
    if (!text.trim()) return;
    let ok = false;
    try {
      await navigator.clipboard.writeText(message);
      ok = true;
    } catch {
      ok = false;
    }
    setCopied(ok ? "yes" : "no");
    window.open(`https://t.me/${FEEDBACK_TG}`, "_blank", "noopener");
  };

  return (
    <Modal
      title="Замечание разработчику"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Закрыть
          </button>
          <button type="button" className="btn" onClick={send} disabled={!text.trim()}>
            <Icon name="chat" size={16} /> Отправить в Telegram
          </button>
        </>
      }
    >
      <p className="small muted">
        Опишите, что не так или что хочется изменить. Раздел и роль добавятся сами. Сообщение уйдёт в Telegram @{FEEDBACK_TG}.
      </p>
      <Field label="Что заметили">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder="Например: в карточке невесты не хватает поля «размер обуви»" autoFocus />
      </Field>
      {copied === "yes" && (
        <p className="callout callout-info" role="status">
          <Icon name="check" size={18} /> Текст скопирован. В открывшемся чате Telegram вставьте его в поле сообщения (долгое нажатие → «Вставить») и отправьте.
        </p>
      )}
      {copied === "no" && (
        <div className="callout callout-info" role="status">
          <span>Не получилось скопировать автоматически. Выделите текст ниже, скопируйте и вставьте в чат Telegram.</span>
          <textarea readOnly value={message} rows={6} onFocus={(e) => e.currentTarget.select()} />
        </div>
      )}
    </Modal>
  );
}
