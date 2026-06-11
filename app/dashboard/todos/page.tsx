"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

type Goal = {
  id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  created_at: string;
};

type Todo = {
  id: string;
  title: string;
  completed: boolean;
  category: string;
  subcategory: string;
  estimated_minutes: number | null;
  goal_id: string | null;
  notes: string | null;
  ai_tags: string[];
  created_at: string;
};

type TimeSession = {
  id: string;
  todo_id: string;
  goal_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
};

type DailyReview = {
  id: string;
  reflection: string;
  ai_summary: string | null;
  ai_suggestions: string | null;
  ai_tags: string[];
};

const defaultCategories = ["学习", "工作", "生活", "研究", "网站开发"];
const defaultSubcategories = ["统计", "编程", "阅读", "写作", "行政", "其他"];

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} 分钟`;
  }

  return `${hours} 小时 ${minutes} 分钟`;
}

function formatClock(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function sessionSeconds(session: TimeSession) {
  if (session.ended_at) {
    return session.duration_seconds;
  }

  return Math.max(0, Math.round((Date.now() - new Date(session.started_at).getTime()) / 1000));
}

function sessionMinutes(session: TimeSession) {
  return Math.round(sessionSeconds(session) / 60);
}

function goalDateProgress(goal: Goal) {
  if (!goal.target_date) {
    return null;
  }

  const createdAt = new Date(goal.created_at).getTime();
  const targetAt = new Date(`${goal.target_date}T23:59:59`).getTime();
  const now = Date.now();

  if (!Number.isFinite(createdAt) || !Number.isFinite(targetAt) || targetAt <= createdAt) {
    return 100;
  }

  return Math.min(100, Math.max(0, Math.round(((now - createdAt) / (targetAt - createdAt)) * 100)));
}

function sumBy<T>(items: T[], getKey: (item: T) => string, getMinutes: (item: T) => number) {
  return items.reduce<Record<string, number>>((totals, item) => {
    const key = getKey(item) || "未分类";
    totals[key] = (totals[key] ?? 0) + getMinutes(item);
    return totals;
  }, {});
}

export default function TodosPage() {
  const [user, setUser] = useState<User | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [sessions, setSessions] = useState<TimeSession[]>([]);
  const [allSessions, setAllSessions] = useState<TimeSession[]>([]);
  const [review, setReview] = useState<DailyReview | null>(null);
  const [reviewText, setReviewText] = useState("");
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalDescription, setNewGoalDescription] = useState("");
  const [newGoalTargetDate, setNewGoalTargetDate] = useState("");
  const [newTodo, setNewTodo] = useState("");
  const [category, setCategory] = useState("学习");
  const [subcategory, setSubcategory] = useState("编程");
  const [estimatedMinutes, setEstimatedMinutes] = useState("25");
  const [goalId, setGoalId] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [, setTick] = useState(0);

  const today = todayIsoDate();

  const sessionsByTodoId = useMemo(
    () =>
      sessions.reduce<Record<string, TimeSession[]>>((groups, session) => {
        groups[session.todo_id] = groups[session.todo_id] ?? [];
        groups[session.todo_id].push(session);
        return groups;
      }, {}),
    [sessions],
  );

  const activeSessionByTodoId = useMemo(
    () =>
      sessions.reduce<Record<string, TimeSession>>((active, session) => {
        if (!session.ended_at) {
          active[session.todo_id] = session;
        }
        return active;
      }, {}),
    [sessions],
  );

  const todoById = useMemo(
    () =>
      todos.reduce<Record<string, Todo>>((lookup, todo) => {
        lookup[todo.id] = todo;
        return lookup;
      }, {}),
    [todos],
  );

  const goalById = useMemo(
    () =>
      goals.reduce<Record<string, Goal>>((lookup, goal) => {
        lookup[goal.id] = goal;
        return lookup;
      }, {}),
    [goals],
  );

  const visibleSessions = sessions.filter((session) => todoById[session.todo_id]);
  const totalMinutes = visibleSessions.reduce((total, session) => total + sessionMinutes(session), 0);
  const minutesByCategory = sumBy(visibleSessions, (session) => todoById[session.todo_id]?.category, sessionMinutes);
  const minutesBySubcategory = sumBy(visibleSessions, (session) => todoById[session.todo_id]?.subcategory, sessionMinutes);
  const minutesByGoal = sumBy(
    visibleSessions,
    (session) => goalById[session.goal_id ?? todoById[session.todo_id]?.goal_id ?? ""]?.title ?? "无长期目标",
    sessionMinutes,
  );
  const totalMinutesByGoalId = allSessions.reduce<Record<string, number>>((totals, session) => {
    if (!session.goal_id) {
      return totals;
    }

    if (!session.ended_at && !todoById[session.todo_id]) {
      return totals;
    }

    totals[session.goal_id] = (totals[session.goal_id] ?? 0) + sessionMinutes(session);
    return totals;
  }, {});
  const completedTodos = todos.filter((todo) => todo.completed);
  const incompleteTodos = todos.filter((todo) => !todo.completed);
  const activeSessions = allSessions.filter((session) => !session.ended_at);
  const timeGapTodos = todos.filter((todo) => {
    const actualMinutes = (sessionsByTodoId[todo.id] ?? []).reduce((total, session) => total + sessionMinutes(session), 0);
    return todo.estimated_minutes !== null && Math.abs(actualMinutes - todo.estimated_minutes) >= 30;
  });

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      setUser(currentUser);

      if (currentUser) {
        const [goalsResult, todosResult, sessionsResult, allSessionsResult, reviewResult] = await Promise.all([
          supabase
            .from("goals")
            .select("id,title,description,target_date,created_at")
            .eq("owner_id", currentUser.id)
            .eq("status", "active")
            .order("created_at", { ascending: false }),
          supabase
            .from("todos")
            .select("id,title,completed,category,subcategory,estimated_minutes,goal_id,notes,ai_tags,created_at")
            .eq("owner_id", currentUser.id)
            .or(`due_on.is.null,due_on.eq.${today}`)
            .order("created_at", { ascending: false }),
          supabase
            .from("task_time_sessions")
            .select("id,todo_id,goal_id,started_at,ended_at,duration_seconds")
            .eq("owner_id", currentUser.id)
            .gte("started_at", `${today}T00:00:00`)
            .lt("started_at", `${today}T23:59:59`)
            .order("started_at", { ascending: false }),
          supabase
            .from("task_time_sessions")
            .select("id,todo_id,goal_id,started_at,ended_at,duration_seconds")
            .eq("owner_id", currentUser.id)
            .order("started_at", { ascending: false }),
          supabase
            .from("daily_reviews")
            .select("id,reflection,ai_summary,ai_suggestions,ai_tags")
            .eq("owner_id", currentUser.id)
            .eq("review_date", today)
            .maybeSingle(),
        ]);

        const firstError =
          goalsResult.error ?? todosResult.error ?? sessionsResult.error ?? allSessionsResult.error ?? reviewResult.error;

        if (firstError) {
          setMessage(firstError.message);
        } else {
          setGoals((goalsResult.data ?? []) as Goal[]);
          setTodos((todosResult.data ?? []) as Todo[]);
          setSessions((sessionsResult.data ?? []) as TimeSession[]);
          setAllSessions((allSessionsResult.data ?? []) as TimeSession[]);
          setReview((reviewResult.data as DailyReview | null) ?? null);
          setReviewText(reviewResult.data?.reflection ?? "");
        }
      }

      setIsLoading(false);
    }

    loadUser();
  }, [today]);

  useEffect(() => {
    if (!sessions.some((session) => !session.ended_at)) {
      return;
    }

    const timer = window.setInterval(() => {
      setTick((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [sessions]);

  async function addGoal() {
    if (!user) {
      setMessage("请先登录。");
      return;
    }

    const title = newGoalTitle.trim();

    if (!title) {
      setMessage("请输入长期目标。");
      return;
    }

    const { data, error } = await supabase
      .from("goals")
      .insert({
        owner_id: user.id,
        title,
        description: newGoalDescription.trim() || null,
        target_date: newGoalTargetDate || null,
      })
      .select("id,title,description,target_date,created_at")
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }

    setGoals((currentGoals) => [data as Goal, ...currentGoals]);
    setNewGoalTitle("");
    setNewGoalDescription("");
    setNewGoalTargetDate("");
    setShowAddGoal(false);
    setMessage("长期目标已创建。");
  }

  async function addTodo() {
    if (!user) {
      setMessage("请先登录。");
      return;
    }

    const title = newTodo.trim();

    if (!title) {
      setMessage("请输入待办内容。");
      return;
    }

    setIsSaving(true);
    setMessage("");

    const { data, error } = await supabase
      .from("todos")
      .insert({
        owner_id: user.id,
        title,
        category,
        subcategory,
        estimated_minutes: estimatedMinutes ? Number(estimatedMinutes) : null,
        goal_id: goalId || null,
        notes: notes.trim() || null,
        due_on: today,
      })
      .select("id,title,completed,category,subcategory,estimated_minutes,goal_id,notes,ai_tags,created_at")
      .single();

    setIsSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setTodos((currentTodos) => [data as Todo, ...currentTodos]);
    setNewTodo("");
    setNotes("");
    setShowMoreOptions(false);
    setMessage("待办已添加。");
  }

  async function toggleTodo(todo: Todo) {
    if (!user) {
      setMessage("请先登录。");
      return;
    }

    const nextCompleted = !todo.completed;
    setTodos((currentTodos) =>
      currentTodos.map((currentTodo) =>
        currentTodo.id === todo.id ? { ...currentTodo, completed: nextCompleted } : currentTodo,
      ),
    );

    const { error } = await supabase.from("todos").update({ completed: nextCompleted }).eq("id", todo.id);

    if (error) {
      setMessage(error.message);
      setTodos((currentTodos) =>
        currentTodos.map((currentTodo) =>
          currentTodo.id === todo.id ? { ...currentTodo, completed: todo.completed } : currentTodo,
        ),
      );
      return;
    }

    const stoppedSession =
      nextCompleted && activeSessionByTodoId[todo.id] ? await stopActiveSession(activeSessionByTodoId[todo.id]) : null;

    if (stoppedSession) {
      applyStoppedSession(stoppedSession);
    }

    setMessage(nextCompleted ? (stoppedSession ? "已完成，并已自动停止计时。" : "已标记完成。") : "已取消完成。");
  }

  async function startTimer(todo: Todo) {
    if (!user || activeSessionByTodoId[todo.id]) {
      return;
    }

    const { data, error } = await supabase
      .from("task_time_sessions")
      .insert({
        owner_id: user.id,
        todo_id: todo.id,
        goal_id: todo.goal_id,
      })
      .select("id,todo_id,goal_id,started_at,ended_at,duration_seconds")
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }

    setSessions((currentSessions) => [data as TimeSession, ...currentSessions]);
    setAllSessions((currentSessions) => [data as TimeSession, ...currentSessions]);
    setMessage("计时已开始。");
  }

  async function stopTimer(todo: Todo) {
    const activeSession = activeSessionByTodoId[todo.id];

    if (!activeSession) {
      return;
    }

    const stoppedSession = await stopActiveSession(activeSession);

    if (!stoppedSession) {
      return;
    }

    applyStoppedSession(stoppedSession);
    setMessage("计时已停止。");
  }

  async function stopAllTimers() {
    if (activeSessions.length === 0) {
      setMessage("现在没有正在计时的任务。");
      return;
    }

    const visibleActiveSessions = activeSessions.filter((session) => todoById[session.todo_id]);
    const hiddenActiveSessions = activeSessions.filter((session) => !todoById[session.todo_id]);
    const stoppedSessions = await Promise.all(visibleActiveSessions.map((session) => stopActiveSession(session)));
    const validSessions = stoppedSessions.filter((session): session is TimeSession => Boolean(session));

    validSessions.forEach(applyStoppedSession);

    if (hiddenActiveSessions.length > 0) {
      const { error } = await supabase
        .from("task_time_sessions")
        .delete()
        .in(
          "id",
          hiddenActiveSessions.map((session) => session.id),
        );

      if (error) {
        setMessage(error.message);
        return;
      }

      removeSessions(hiddenActiveSessions.map((session) => session.id));
    }

    setMessage(`已停止 ${validSessions.length} 个任务，清理 ${hiddenActiveSessions.length} 个隐藏计时。`);
  }

  function applyStoppedSession(stoppedSession: TimeSession) {
    setSessions((currentSessions) =>
      currentSessions.map((session) => (session.id === stoppedSession.id ? stoppedSession : session)),
    );
    setAllSessions((currentSessions) =>
      currentSessions.map((session) => (session.id === stoppedSession.id ? stoppedSession : session)),
    );
  }

  function removeSessions(sessionIds: string[]) {
    const idSet = new Set(sessionIds);
    setSessions((currentSessions) => currentSessions.filter((session) => !idSet.has(session.id)));
    setAllSessions((currentSessions) => currentSessions.filter((session) => !idSet.has(session.id)));
  }

  async function stopActiveSession(activeSession: TimeSession) {
    const endedAt = new Date();
    const durationSeconds = Math.max(
      0,
      Math.round((endedAt.getTime() - new Date(activeSession.started_at).getTime()) / 1000),
    );

    const { data, error } = await supabase
      .from("task_time_sessions")
      .update({
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSeconds,
      })
      .eq("id", activeSession.id)
      .select("id,todo_id,goal_id,started_at,ended_at,duration_seconds")
      .single();

    if (error) {
      setMessage(error.message);
      return null;
    }

    return data as TimeSession;
  }

  async function deleteTodo(todo: Todo) {
    if (!user) {
      setMessage("请先登录。");
      return;
    }

    const shouldDelete = window.confirm("确定删除这个待办吗？这个任务的计时记录也会一起删除。");

    if (!shouldDelete) {
      return;
    }

    const { error } = await supabase.from("todos").delete().eq("id", todo.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setTodos((currentTodos) => currentTodos.filter((currentTodo) => currentTodo.id !== todo.id));
    setSessions((currentSessions) => currentSessions.filter((session) => session.todo_id !== todo.id));
    setAllSessions((currentSessions) => currentSessions.filter((session) => session.todo_id !== todo.id));
    setMessage("待办已删除。");
  }

  async function saveReview() {
    if (!user) {
      setMessage("请先登录。");
      return;
    }

    const payload = {
      owner_id: user.id,
      review_date: today,
      reflection: reviewText,
      ai_summary: review?.ai_summary ?? null,
      ai_suggestions: review?.ai_suggestions ?? null,
      ai_tags: review?.ai_tags ?? [],
    };

    const { data, error } = await supabase
      .from("daily_reviews")
      .upsert(payload, { onConflict: "owner_id,review_date" })
      .select("id,reflection,ai_summary,ai_suggestions,ai_tags")
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }

    setReview(data as DailyReview);
    setMessage("Daily reflection 已保存。");
  }

  return (
    <main className="dashboard-page todos-page">
      <section className="dashboard-hero">
        <p className="eyebrow">Today</p>
        <p className="version-marker">版本标记：SELECT-FIX</p>
        <h1>待办和计时</h1>
        {isLoading ? <p>正在读取登录状态...</p> : null}
        {!isLoading && !user ? (
          <>
            <p>登录后，这里的待办事项和计时记录会保存到你的账号里。</p>
            <a className="button primary" href="/login">
              去登录
            </a>
          </>
        ) : null}
        {user ? <p>已登录：{user.email}</p> : null}
      </section>

      <section className="stats-grid">
        <article className="stat-card">
          <span>今日总计时</span>
          <strong>{formatMinutes(totalMinutes)}</strong>
        </article>
        <article className="stat-card">
          <span>已完成</span>
          <strong>{completedTodos.length}</strong>
        </article>
        <article className="stat-card">
          <span>未完成</span>
          <strong>{incompleteTodos.length}</strong>
        </article>
      </section>

      <section className="goal-task-layout">
        <aside className="editor-panel goal-column">
          <div className="panel-heading-row">
            <div>
              <p className="eyebrow">Goals</p>
              <h2>长期目标</h2>
            </div>
            <button className="mini-button" type="button" onClick={() => setShowAddGoal((value) => !value)}>
              {showAddGoal ? "收起" : "+ 添加长期目标"}
            </button>
          </div>
          {showAddGoal ? (
            <div className="compact-form">
              <label htmlFor="goal-title">目标标题</label>
              <input
                id="goal-title"
                value={newGoalTitle}
                onChange={(event) => setNewGoalTitle(event.target.value)}
                placeholder="例如：21 天完成统计复习"
                disabled={!user}
              />
              <label htmlFor="goal-target-date">目标日期</label>
              <input
                id="goal-target-date"
                type="date"
                value={newGoalTargetDate}
                onChange={(event) => setNewGoalTargetDate(event.target.value)}
                disabled={!user}
              />
              <label htmlFor="goal-description">描述（可选）</label>
              <textarea
                id="goal-description"
                value={newGoalDescription}
                onChange={(event) => setNewGoalDescription(event.target.value)}
                rows={2}
                placeholder="目标背景、标准或备注"
                disabled={!user}
              />
              <button className="button secondary" type="button" onClick={addGoal} disabled={!user}>
                保存长期目标
              </button>
            </div>
          ) : null}
          {message ? <p className="auth-message">{message}</p> : null}
          <div className="goal-list">
            {goals.length === 0 ? <p className="timer-status">还没有长期目标。</p> : null}
            {goals.map((goal) => {
              const progress = goalDateProgress(goal);

              return (
                <article className="goal-card" key={goal.id}>
                  <strong>{goal.title}</strong>
                  {goal.description ? <span>{goal.description}</span> : null}
                  <span>{goal.target_date ? `目标日期：${goal.target_date}` : "没有目标日期"}</span>
                  <p className="goal-time-text">
                    总投入：{formatMinutes(totalMinutesByGoalId[goal.id] ?? 0)} · 今日投入：
                    {formatMinutes(minutesByGoal[goal.title] ?? 0)}
                  </p>
                  {progress !== null ? (
                    <div className="goal-progress-track" aria-label="目标时间进度">
                      <div className="goal-progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </aside>

        <div className="short-task-column">
          <section className="editor-panel quick-add-panel">
            <div className="panel-heading-row">
              <div>
                <p className="eyebrow">Today</p>
                <h2>快速添加今日待办</h2>
              </div>
              <button className="mini-button" type="button" onClick={() => setShowMoreOptions((value) => !value)}>
                {showMoreOptions ? "收起选项" : "更多选项"}
              </button>
            </div>
            <div className="quick-add-row">
              <input
                id="todo-title"
                value={newTodo}
                onChange={(event) => setNewTodo(event.target.value)}
                placeholder="任务标题"
                disabled={!user}
              />
              <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="大类" disabled={!user}>
                {defaultCategories.map((item) => (
                  <option value={item} key={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select
                value={subcategory}
                onChange={(event) => setSubcategory(event.target.value)}
                aria-label="小类"
                disabled={!user}
              >
                {defaultSubcategories.map((item) => (
                  <option value={item} key={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select value={goalId} onChange={(event) => setGoalId(event.target.value)} disabled={!user}>
                <option value="">无长期目标</option>
                {goals.map((goal) => (
                  <option value={goal.id} key={goal.id}>
                    {goal.title}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                value={estimatedMinutes}
                onChange={(event) => setEstimatedMinutes(event.target.value)}
                aria-label="预计用时（分钟）"
                placeholder="分钟"
                disabled={!user}
              />
              <button className="button primary" type="button" onClick={addTodo} disabled={!user || isSaving}>
                {isSaving ? "添加中..." : "添加"}
              </button>
            </div>
            {showMoreOptions ? (
              <div className="form-grid">
                <label>
                  大类
                  <input
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    list="category-options"
                    disabled={!user}
                  />
                </label>
                <label>
                  小类
                  <input
                    value={subcategory}
                    onChange={(event) => setSubcategory(event.target.value)}
                    list="subcategory-options"
                    disabled={!user}
                  />
                </label>
                <label className="wide-field">
                  备注
                  <textarea
                    id="todo-notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="补充说明，AI tags 字段已预留在数据库里。"
                    rows={2}
                    disabled={!user}
                  />
                </label>
              </div>
            ) : null}
            <datalist id="category-options">
              {defaultCategories.map((item) => (
                <option value={item} key={item} />
              ))}
            </datalist>
            <datalist id="subcategory-options">
              {defaultSubcategories.map((item) => (
                <option value={item} key={item} />
              ))}
            </datalist>
          </section>

          <section className="editor-panel today-list-panel">
            <div className="panel-heading-row">
              <div>
                <p className="eyebrow">Task list</p>
                <h2>今天的待办列表</h2>
              </div>
              <div className="list-heading-actions">
                <button className="mini-button" type="button" onClick={stopAllTimers} disabled={!user || activeSessions.length === 0}>
                  停止全部计时
                </button>
                <span className="list-count">TASK-CARDS · {todos.length} 项</span>
              </div>
            </div>
            <div className="todo-preview-list task-focus-list">
              {todos.length === 0 ? <p className="timer-status">还没有待办。登录后可以添加今天的任务。</p> : null}
              {[...todos]
                .sort((a, b) => Number(a.completed) - Number(b.completed))
                .map((todo) => {
                const todoSessions = sessionsByTodoId[todo.id] ?? [];
                const actualSeconds = todoSessions.reduce((total, session) => total + sessionSeconds(session), 0);
                const actualMinutes = Math.round(actualSeconds / 60);
                const activeSession = activeSessionByTodoId[todo.id];
                const goalTitle = todo.goal_id ? goalById[todo.goal_id]?.title : "";
                const estimatedSeconds = todo.estimated_minutes ? todo.estimated_minutes * 60 : null;
                const overtimeSeconds =
                  estimatedSeconds === null ? 0 : Math.max(0, actualSeconds - estimatedSeconds);
                const remainingSeconds =
                  estimatedSeconds === null ? actualSeconds : Math.max(0, estimatedSeconds - actualSeconds);
                const timerSeconds =
                  estimatedSeconds !== null && overtimeSeconds > 0 ? overtimeSeconds : remainingSeconds;
                const timerLabel =
                  estimatedSeconds === null ? "累计" : overtimeSeconds > 0 ? "超时" : "倒计时";
                const timerClassName = [
                  "timer-pill",
                  estimatedSeconds === null ? "elapsed" : overtimeSeconds > 0 ? "over" : "countdown",
                  activeSession ? "active" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <article
                    className={[
                      "todo-card",
                      activeSession ? "todo-card-running" : "",
                      todo.completed ? "todo-card-completed" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={todo.id}
                  >
                    <div className="todo-card-main">
                      <div className="todo-card-content">
                      <label className="todo-item">
                        <input
                          type="checkbox"
                          checked={todo.completed}
                          onChange={() => toggleTodo(todo)}
                          disabled={!user}
                        />
                        <span className={todo.completed ? "todo-done" : undefined}>{todo.title}</span>
                      </label>
                        <div className="task-meta-row">
                          <span>{goalTitle || "无长期目标"}</span>
                          <span>{todo.category} / {todo.subcategory}</span>
                          <span>
                            {todo.estimated_minutes ? `预计 ${formatMinutes(todo.estimated_minutes)}` : "无预计时间"}
                          </span>
                          <span>实际 {formatMinutes(actualMinutes)}</span>
                          <span>{todoSessions.length ? `计时段数 ${todoSessions.length}` : "未计时"}</span>
                        </div>
                        {todo.notes ? <p>{todo.notes}</p> : null}
                      </div>
                      <div className="todo-card-controls">
                      <div className={timerClassName}>
                        <span>{timerLabel}</span>
                        <strong>{formatClock(timerSeconds)}</strong>
                      </div>
                        {activeSession ? (
                          <button
                            className="button primary compact-action"
                            type="button"
                            onClick={() => stopTimer(todo)}
                            disabled={!user}
                          >
                            Stop
                          </button>
                        ) : (
                          <button
                            className="button secondary compact-action"
                            type="button"
                            onClick={() => startTimer(todo)}
                            disabled={!user}
                          >
                            Start
                          </button>
                        )}
                        <button
                          className="button secondary compact-action danger-action"
                          type="button"
                          onClick={() => deleteTodo(todo)}
                          disabled={!user}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="editor-panel today-side-list">
          <div className="panel-heading-row side-heading-row">
            <h2>今日列表</h2>
          </div>
          <div className="side-task-list">
            {todos.length === 0 ? <p className="timer-status">还没有任务。</p> : null}
            {[...todos]
              .sort((a, b) => Number(a.completed) - Number(b.completed))
              .map((todo) => {
                const activeSession = activeSessionByTodoId[todo.id];

                return (
                  <label
                    className={[
                      "side-task-item",
                      activeSession ? "side-task-running" : "",
                      todo.completed ? "side-task-completed" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={todo.id}
                  >
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={() => toggleTodo(todo)}
                      disabled={!user}
                    />
                    <span>{todo.title}</span>
                  </label>
                );
              })}
          </div>
        </aside>
      </section>

      <section className="summary-grid-four">
        <StatsCard title="按大类" rows={minutesByCategory} />
        <StatsCard title="按小类" rows={minutesBySubcategory} />
        <StatsCard title="按长期目标" rows={minutesByGoal} />
        <article className="card">
          <p className="card-meta">Time gap</p>
          <h2>预计 / 实际差距较大</h2>
          {timeGapTodos.length === 0 ? <p>暂无明显超时或低估任务。</p> : null}
          {timeGapTodos.map((todo) => (
            <p key={todo.id}>{todo.title}</p>
          ))}
        </article>
      </section>

      <section className="dashboard-grid">
        <ListCard title="今天完成了" items={completedTodos.map((todo) => todo.title)} />
        <ListCard title="今天未完成" items={incompleteTodos.map((todo) => todo.title)} />
      </section>

      <section className="editor-panel">
        <h2>Daily reflection</h2>
        <textarea
          value={reviewText}
          onChange={(event) => setReviewText(event.target.value)}
          placeholder="今天的复盘：哪些目标推进了？哪些被忽略了？"
          rows={6}
          disabled={!user}
        />
        <div className="dashboard-actions">
          <button className="button primary" type="button" onClick={saveReview} disabled={!user}>
            保存 reflection
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={() => setMessage("AI analysis will be added later.")}
            disabled={!user}
          >
            Generate AI Summary
          </button>
        </div>
        <p className="timer-status">AI summary、AI suggestions、AI tags 字段已经预留，暂时不调用任何 AI API。</p>
      </section>
    </main>
  );
}

function StatsCard({ title, rows }: { title: string; rows: Record<string, number> }) {
  const entries = Object.entries(rows).sort((a, b) => b[1] - a[1]);

  return (
    <article className="card">
      <p className="card-meta">Summary</p>
      <h2>{title}</h2>
      {entries.length === 0 ? <p>暂无计时数据。</p> : null}
      {entries.map(([name, minutes]) => (
        <p key={name}>
          {name}: {formatMinutes(minutes)}
        </p>
      ))}
    </article>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <article className="card">
      <p className="card-meta">Tasks</p>
      <h2>{title}</h2>
      {items.length === 0 ? <p>暂无。</p> : null}
      {items.map((item) => (
        <p key={item}>{item}</p>
      ))}
    </article>
  );
}
