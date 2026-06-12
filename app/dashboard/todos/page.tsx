"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ChangeEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

type Goal = {
  id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  status: string;
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

type HiddenTodoDate = {
  todo_id: string;
};

type WeekBlock = {
  id: string;
  day: string;
  title: string;
  startMinutes: number;
  endMinutes: number;
  source: "todo" | "google";
};

const defaultCategories = ["学习", "工作", "生活", "研究", "网站开发"];
const defaultSubcategories = ["统计", "编程", "阅读", "写作", "行政", "其他"];

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseIsoDate(date: string) {
  return new Date(`${date}T00:00:00`);
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("zh-CN", { month: "long", year: "numeric" });
}

function calendarDays(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDate = new Date(year, month, 1);
  const firstWeekday = firstDate.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: Array<string | null> = Array.from({ length: firstWeekday }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(toIsoDate(new Date(year, month, day)));
  }

  return days;
}

function dayBounds(date: string) {
  const start = parseIsoDate(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function weekDates(date: string) {
  const selected = parseIsoDate(date);
  const sunday = new Date(selected);
  sunday.setDate(selected.getDate() - selected.getDay());

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(sunday);
    day.setDate(sunday.getDate() + index);
    return toIsoDate(day);
  });
}

function minutesFromMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function formatTimeRange(startMinutes: number, endMinutes: number) {
  const format = (minutes: number) => {
    const date = new Date();
    date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase();
  };

  return `${format(startMinutes)} – ${format(endMinutes)}`;
}

function formatHourLabel(hour: number) {
  if (hour === 0) {
    return "12 AM";
  }

  if (hour === 12) {
    return "12 PM";
  }

  return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
}

function parseIcsDate(value: string) {
  const cleanValue = value.trim();
  const match = cleanValue.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?/);

  if (!match) {
    return null;
  }

  const [, year, month, day, hour = "00", minute = "00", second = "00", isUtc] = match;

  if (isUtc) {
    return new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)),
    );
  }

  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
}

function cleanIcsText(value: string) {
  return value.replace(/\\,/g, ",").replace(/\\n/g, " ").replace(/\\/g, "");
}

function parseGoogleCalendarIcs(text: string): WeekBlock[] {
  return text
    .replace(/\r?\n[ \t]/g, "")
    .split("BEGIN:VEVENT")
    .slice(1)
    .map<WeekBlock | null>((eventText, index) => {
      const summary = eventText.match(/\nSUMMARY(?:;[^:]*)?:(.*)/)?.[1]?.trim() ?? "Google Calendar event";
      const uid = eventText.match(/\nUID(?:;[^:]*)?:(.*)/)?.[1]?.trim() ?? `google-${index}`;
      const startText = eventText.match(/\nDTSTART(?:;[^:]*)?:(.*)/)?.[1]?.trim();
      const endText = eventText.match(/\nDTEND(?:;[^:]*)?:(.*)/)?.[1]?.trim();
      const start = startText ? parseIcsDate(startText) : null;
      const end = endText ? parseIcsDate(endText) : null;

      if (!start || !end) {
        return null;
      }

      return {
        id: uid,
        day: toIsoDate(start),
        title: cleanIcsText(summary),
        startMinutes: minutesFromMidnight(start),
        endMinutes: Math.max(minutesFromMidnight(start) + 1, minutesFromMidnight(end)),
        source: "google" as const,
      };
    })
    .filter((block): block is WeekBlock => Boolean(block));
}

function buildWeekBlocks(sessions: TimeSession[], todosById: Record<string, Todo>, selectedDate: string) {
  const dates = weekDates(selectedDate);
  const dateSet = new Set(dates);
  const mergeGapMinutes = 10;
  const sortedSessions = sessions
    .filter((session) => session.ended_at)
    .map((session) => {
      const start = new Date(session.started_at);
      const end = new Date(session.ended_at ?? session.started_at);
      return {
        ...session,
        day: toIsoDate(start),
        startMinutes: minutesFromMidnight(start),
        endMinutes: Math.max(minutesFromMidnight(start) + 1, minutesFromMidnight(end)),
      };
    })
    .filter((session) => dateSet.has(session.day) && todosById[session.todo_id])
    .sort(
      (a, b) =>
        a.day.localeCompare(b.day) ||
        a.todo_id.localeCompare(b.todo_id) ||
        a.startMinutes - b.startMinutes ||
        a.endMinutes - b.endMinutes,
    );

  const groupedSessions = sortedSessions.reduce<Record<string, typeof sortedSessions>>((groups, session) => {
    const key = `${session.day}:${session.todo_id}`;
    groups[key] = groups[key] ?? [];
    groups[key].push(session);
    return groups;
  }, {});

  return Object.values(groupedSessions)
    .flatMap((group) =>
      group.reduce<WeekBlock[]>((blocks, session) => {
        const todo = todosById[session.todo_id];
        const previous = blocks[blocks.length - 1];

        if (previous && session.startMinutes - previous.endMinutes <= mergeGapMinutes) {
          previous.endMinutes = Math.max(previous.endMinutes, session.endMinutes);
          return blocks;
        }

        blocks.push({
          id: session.todo_id,
          day: session.day,
          title: todo.title,
          startMinutes: session.startMinutes,
          endMinutes: session.endMinutes,
          source: "todo",
        });
        return blocks;
      }, []),
    )
    .sort((a, b) => a.day.localeCompare(b.day) || a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes);
}

function dedupeWeekBlocks(blocks: WeekBlock[]) {
  const seen = new Set<string>();

  return blocks.filter((block) => {
    const key = [block.source, block.id, block.day, block.title, block.startMinutes, block.endMinutes].join(":");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
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

function layoutWeekBlocks(blocks: WeekBlock[], dates: string[]) {
  return dates.flatMap((date) => {
    const dayBlocks = blocks
      .filter((block) => block.day === date)
      .sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes);
    const clusters: WeekBlock[][] = [];

    dayBlocks.forEach((block) => {
      const currentCluster = clusters[clusters.length - 1];
      const clusterEnd = currentCluster ? Math.max(...currentCluster.map((item) => item.endMinutes)) : -Infinity;

      if (!currentCluster || block.startMinutes >= clusterEnd) {
        clusters.push([block]);
        return;
      }

      currentCluster.push(block);
    });

    return clusters.flatMap((cluster) => {
      const laneEnds: number[] = [];
      const laidOutCluster = cluster.map((block) => {
        const laneIndex = laneEnds.findIndex((endMinutes) => block.startMinutes >= endMinutes);
        const lane = laneIndex === -1 ? laneEnds.length : laneIndex;
        laneEnds[lane] = block.endMinutes;

        return { ...block, lane };
      });
      const laneCount = Math.max(1, laneEnds.length);

      return laidOutCluster.map((block) => {
        const compactOverlap = laneCount > 1;
        const laneWidth = compactOverlap ? 0.76 : 1;
        const laneOffset = compactOverlap ? (block.lane / Math.max(1, laneCount - 1)) * (1 - laneWidth) : 0;

        return { ...block, laneCount, laneOffset, laneWidth };
      });
    });
  });
}

export default function TodosPage() {
  const [user, setUser] = useState<User | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [allTodos, setAllTodos] = useState<Todo[]>([]);
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
  const [selectedDate, setSelectedDate] = useState(todayIsoDate());
  const [calendarMonth, setCalendarMonth] = useState(() => parseIsoDate(todayIsoDate()));
  const [importedCalendarBlocks, setImportedCalendarBlocks] = useState<WeekBlock[]>([]);
  const [isWeekExpanded, setIsWeekExpanded] = useState(false);
  const [isDayExpanded, setIsDayExpanded] = useState(false);
  const [, setTick] = useState(0);

  const today = selectedDate;
  const realToday = todayIsoDate();
  const calendarDates = useMemo(() => calendarDays(calendarMonth), [calendarMonth]);

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

  const allTodoById = useMemo(
    () =>
      allTodos.reduce<Record<string, Todo>>((lookup, todo) => {
        lookup[todo.id] = todo;
        return lookup;
      }, {}),
    [allTodos],
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
  const selectedWeekDates = useMemo(() => weekDates(today), [today]);
  const todoWeekBlocks = useMemo(() => buildWeekBlocks(allSessions, allTodoById, today), [allSessions, allTodoById, today]);
  const weekBlocks = useMemo(
    () =>
      dedupeWeekBlocks([...todoWeekBlocks, ...importedCalendarBlocks.filter((block) => selectedWeekDates.includes(block.day))]).sort(
        (a, b) => a.day.localeCompare(b.day) || a.startMinutes - b.startMinutes,
      ),
    [importedCalendarBlocks, selectedWeekDates, todoWeekBlocks],
  );
  const timeGapTodos = todos.filter((todo) => {
    const actualMinutes = (sessionsByTodoId[todo.id] ?? []).reduce((total, session) => total + sessionMinutes(session), 0);
    return todo.estimated_minutes !== null && Math.abs(actualMinutes - todo.estimated_minutes) >= 30;
  });

  useEffect(() => {
    async function loadUser() {
      setIsLoading(true);
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      setUser(currentUser);

      if (currentUser) {
        const selectedDayBounds = dayBounds(today);
        const todoDateFilter = today === realToday ? `due_on.is.null,due_on.eq.${today}` : `due_on.eq.${today}`;
        const [
          goalsResult,
          todosResult,
          allTodosResult,
          hiddenTodosResult,
          sessionsResult,
          allSessionsResult,
          reviewResult,
        ] = await Promise.all([
          supabase
            .from("goals")
            .select("id,title,description,target_date,status,created_at")
            .eq("owner_id", currentUser.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("todos")
            .select("id,title,completed,category,subcategory,estimated_minutes,goal_id,notes,ai_tags,created_at")
            .eq("owner_id", currentUser.id)
            .or(todoDateFilter)
            .order("created_at", { ascending: false }),
          supabase
            .from("todos")
            .select("id,title,completed,category,subcategory,estimated_minutes,goal_id,notes,ai_tags,created_at")
            .eq("owner_id", currentUser.id),
          supabase
            .from("todo_hidden_dates")
            .select("todo_id")
            .eq("owner_id", currentUser.id)
            .eq("hidden_on", today),
          supabase
            .from("task_time_sessions")
            .select("id,todo_id,goal_id,started_at,ended_at,duration_seconds")
            .eq("owner_id", currentUser.id)
            .gte("started_at", selectedDayBounds.start)
            .lt("started_at", selectedDayBounds.end)
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
          goalsResult.error ??
          todosResult.error ??
          allTodosResult.error ??
          sessionsResult.error ??
          allSessionsResult.error ??
          reviewResult.error;

        if (firstError) {
          setMessage(firstError.message);
        } else {
          setGoals((goalsResult.data ?? []) as Goal[]);
          if (hiddenTodosResult.error) {
            setMessage(`需要先运行隐藏待办迁移：${hiddenTodosResult.error.message}`);
          }

          const hiddenTodoIds = new Set(((hiddenTodosResult.data ?? []) as HiddenTodoDate[]).map((item) => item.todo_id));
          setTodos(((todosResult.data ?? []) as Todo[]).filter((todo) => !hiddenTodoIds.has(todo.id)));
          setAllTodos((allTodosResult.data ?? []) as Todo[]);
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

  function changeCalendarMonth(offset: number) {
    setCalendarMonth((currentMonth) => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1));
  }

  function chooseCalendarDate(date: string) {
    setSelectedDate(date);
    setCalendarMonth(parseIsoDate(date));
  }

  async function importGoogleCalendarFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const text = await file.text();
    const blocks = parseGoogleCalendarIcs(text);
    setImportedCalendarBlocks(blocks);
    setMessage(`已导入 ${blocks.length} 个 Google Calendar 事件，只读显示，不会写回 Google Calendar。`);
    event.target.value = "";
  }

  function requestGoogleCalendarConnect() {
    setMessage("下一步会接 Google 登录和 Calendar 只读授权；现在不会再要求手动上传文件。");
  }

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
      .select("id,title,description,target_date,status,created_at")
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

  async function toggleGoalDone(goal: Goal) {
    if (!user) {
      setMessage("请先登录。");
      return;
    }

    const nextStatus = goal.status === "completed" ? "active" : "completed";

    setGoals((currentGoals) =>
      currentGoals.map((currentGoal) =>
        currentGoal.id === goal.id ? { ...currentGoal, status: nextStatus } : currentGoal,
      ),
    );

    const { error } = await supabase.from("goals").update({ status: nextStatus }).eq("id", goal.id);

    if (error) {
      setGoals((currentGoals) =>
        currentGoals.map((currentGoal) =>
          currentGoal.id === goal.id ? { ...currentGoal, status: goal.status } : currentGoal,
        ),
      );
      setMessage(error.message);
    }
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
    setAllTodos((currentTodos) => [data as Todo, ...currentTodos]);
    setNewTodo("");
    setNotes("");
    setShowMoreOptions(false);
    setMessage("待办已添加。");
  }

  async function updateTodoEstimate(todo: Todo, value: string) {
    if (!user) {
      setMessage("请先登录。");
      return;
    }

    const nextEstimatedMinutes = value ? Number(value) : null;

    if (nextEstimatedMinutes !== null && (!Number.isFinite(nextEstimatedMinutes) || nextEstimatedMinutes < 0)) {
      setMessage("请输入有效的预计分钟数。");
      return;
    }

    const { error } = await supabase
      .from("todos")
      .update({ estimated_minutes: nextEstimatedMinutes })
      .eq("id", todo.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    const updateTodo = (currentTodo: Todo) =>
      currentTodo.id === todo.id ? { ...currentTodo, estimated_minutes: nextEstimatedMinutes } : currentTodo;
    setTodos((currentTodos) => currentTodos.map(updateTodo));
    setAllTodos((currentTodos) => currentTodos.map(updateTodo));
    setMessage("倒计时时长已更新。");
  }

  function promptUpdateTodoEstimate(todo: Todo) {
    const nextValue = window.prompt("修改倒计时预计分钟数：", todo.estimated_minutes?.toString() ?? "");

    if (nextValue === null) {
      return;
    }

    updateTodoEstimate(todo, nextValue.trim());
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
    const upsertSession = (currentSessions: TimeSession[]) => {
      const hasSession = currentSessions.some((session) => session.id === stoppedSession.id);

      if (!hasSession) {
        return [stoppedSession, ...currentSessions];
      }

      return currentSessions.map((session) => (session.id === stoppedSession.id ? stoppedSession : session));
    };

    setSessions(upsertSession);
    setAllSessions(upsertSession);
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

    const shouldHide = window.confirm("从这一天的列表移除这个待办吗？历史计时记录会保留。");

    if (!shouldHide) {
      return;
    }

    const activeSession = activeSessionByTodoId[todo.id];

    if (activeSession) {
      const stoppedSession = await stopActiveSession(activeSession);

      if (stoppedSession) {
        applyStoppedSession(stoppedSession);
      }
    }

    const { error } = await supabase.from("todo_hidden_dates").upsert(
      {
        owner_id: user.id,
        todo_id: todo.id,
        hidden_on: today,
      },
      { onConflict: "owner_id,todo_id,hidden_on" },
    );

    if (error) {
      setMessage(error.message);
      return;
    }

    setTodos((currentTodos) => currentTodos.filter((currentTodo) => currentTodo.id !== todo.id));
    setMessage("已从这一天移除，历史记录已保留。");
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
        <div className="todos-hero-top">
          <h1>待办和计时</h1>
          <div className="hero-mini-nav">
            <a className="mini-button" href="/">
              回到主页
            </a>
            <p className="version-marker">版本标记：GOAL-CHECK-CLEAN</p>
          </div>
          <div className="todos-hero-meta">
            {isLoading ? <span>正在读取登录状态...</span> : null}
            {!isLoading && !user ? (
              <>
                <span>登录后，待办事项和计时记录会保存到你的账号里。</span>
                <a className="mini-button" href="/login">
                  去登录
                </a>
              </>
            ) : null}
            {user ? <span>已登录：{user.email}</span> : null}
            <span>当前日期：{today}</span>
          </div>
        </div>

        <div className="todos-calendar-row">
          <aside className="calendar-panel" aria-label="日期选择器">
            <div className="calendar-header">
              <button className="mini-button" type="button" onClick={() => changeCalendarMonth(-1)}>
                上月
              </button>
              <strong>{monthLabel(calendarMonth)}</strong>
              <button className="mini-button" type="button" onClick={() => changeCalendarMonth(1)}>
                下月
              </button>
            </div>
            <div className="calendar-weekdays">
              {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="calendar-grid">
              {calendarDates.map((date, index) =>
                date ? (
                  <button
                    className={[
                      "calendar-day",
                      date === today ? "selected" : "",
                      date === realToday ? "today" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    type="button"
                    onClick={() => chooseCalendarDate(date)}
                    key={date}
                  >
                    {parseIsoDate(date).getDate()}
                  </button>
                ) : (
                  <span className="calendar-empty" key={`empty-${index}`} />
                ),
              )}
            </div>
          </aside>

          <WeekCalendar
            blocks={weekBlocks}
            dates={selectedWeekDates}
            importedCount={importedCalendarBlocks.length}
            isExpanded={false}
            onChooseDate={chooseCalendarDate}
            onConnectGoogle={requestGoogleCalendarConnect}
            onExpand={() => setIsWeekExpanded(true)}
            onImport={importGoogleCalendarFile}
            selectedDate={today}
          />

          <DayCalendar blocks={weekBlocks} onExpand={() => setIsDayExpanded(true)} selectedDate={today} />
        </div>
      </section>

      {isWeekExpanded ? (
        <div className="week-modal" role="dialog" aria-modal="true" aria-label="全屏一周计划">
          <WeekCalendar
            blocks={weekBlocks}
            dates={selectedWeekDates}
            importedCount={importedCalendarBlocks.length}
            isExpanded
            onChooseDate={chooseCalendarDate}
            onConnectGoogle={requestGoogleCalendarConnect}
            onClose={() => setIsWeekExpanded(false)}
            onImport={importGoogleCalendarFile}
            selectedDate={today}
          />
        </div>
      ) : null}

      {isDayExpanded ? (
        <div className="week-modal" role="dialog" aria-modal="true" aria-label="放大今天日历">
          <DayCalendar blocks={weekBlocks} isExpanded onClose={() => setIsDayExpanded(false)} selectedDate={today} />
        </div>
      ) : null}

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
              const isGoalDone = goal.status === "completed";

              return (
                <article className={isGoalDone ? "goal-card goal-card-completed" : "goal-card"} key={goal.id}>
                  <div className="goal-card-header">
                    <strong className="goal-card-title">{goal.title}</strong>
                    <label className="goal-done-control">
                      <input
                        type="checkbox"
                        checked={isGoalDone}
                        onChange={() => toggleGoalDone(goal)}
                        disabled={!user}
                      />
                      <span>完成</span>
                    </label>
                  </div>
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
                      <label className="task-title-line">
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
                        <button
                          className={timerClassName}
                          type="button"
                          onClick={() => promptUpdateTodoEstimate(todo)}
                          disabled={!user}
                          title="点击修改预计分钟数"
                        >
                          <span>{timerLabel}</span>
                          <strong>{formatClock(timerSeconds)}</strong>
                        </button>
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
                          移除
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

function WeekCalendar({
  blocks,
  dates,
  importedCount,
  isExpanded,
  onChooseDate,
  onConnectGoogle,
  onClose,
  onExpand,
  onImport,
  selectedDate,
}: {
  blocks: WeekBlock[];
  dates: string[];
  importedCount: number;
  isExpanded: boolean;
  onChooseDate: (date: string) => void;
  onConnectGoogle: () => void;
  onClose?: () => void;
  onExpand?: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
  selectedDate: string;
}) {
  const startHour = 8;
  const endHour = 22;
  const dayStart = startHour * 60;
  const dayMinutes = (endHour - startHour) * 60;
  const laidOutBlocks = layoutWeekBlocks(blocks, dates);
  const inputId = isExpanded ? "google-calendar-import-full" : "google-calendar-import-mini";

  return (
    <aside className={isExpanded ? "week-panel week-panel-expanded" : "week-panel"} aria-label="一周计划">
      <div className="week-header">
        <div>
          <strong>一周计划</strong>
          <span>计时结束后会自动进入这里</span>
        </div>
        <div className="week-header-actions">
          <label className="mini-button import-button" htmlFor={inputId}>
            导入 .ics
            <input id={inputId} type="file" accept=".ics,text/calendar" onChange={onImport} />
          </label>
          <button className="mini-button" type="button" onClick={onConnectGoogle}>
            连接 Google
          </button>
          {isExpanded ? (
            <button className="mini-button" type="button" onClick={onClose}>
              关闭
            </button>
          ) : (
            <button className="mini-button icon-button" type="button" onClick={onExpand} aria-label="放大一周计划">
              ↗
            </button>
          )}
        </div>
      </div>

      <div className="week-grid-view">
        <div className="week-grid-head">
          <span />
          {dates.map((date) => (
            <button
              className={date === selectedDate ? "week-date selected" : "week-date"}
              type="button"
              onClick={() => onChooseDate(date)}
              key={date}
            >
              <span>{parseIsoDate(date).toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}</span>
              <strong>{parseIsoDate(date).getDate()}</strong>
            </button>
          ))}
        </div>

        <div className="week-grid-body">
          <div className="week-time-axis">
            {Array.from({ length: endHour - startHour + 1 }, (_, index) => (
              <span key={index}>{formatHourLabel(startHour + index)}</span>
            ))}
          </div>
          <div className="week-days-body">
            <div className="week-day-columns">
              {dates.map((date) => (
                <button
                  className={date === selectedDate ? "week-day-column selected" : "week-day-column"}
                  type="button"
                  aria-label={`查看 ${date}`}
                  onClick={() => onChooseDate(date)}
                  key={date}
                />
              ))}
            </div>
            {laidOutBlocks.map((block, index) => {
              const dayIndex = dates.indexOf(block.day);

              if (dayIndex < 0) {
                return null;
              }

              const clippedStart = Math.max(dayStart, block.startMinutes);
              const clippedEnd = Math.min(endHour * 60, block.endMinutes);
              const top = ((clippedStart - dayStart) / dayMinutes) * 100;
              const height = Math.max(0.7, ((clippedEnd - clippedStart) / dayMinutes) * 100);
              const dayWidth = 100 / 7;
              const fullLeft = dayIndex * dayWidth;
              const blockLeft = fullLeft + block.laneOffset * dayWidth;
              const blockWidth = dayWidth * block.laneWidth;
              const isOverlapped = block.laneCount > 1;
              const eventStyle = {
                "--event-full-left": `${fullLeft}%`,
                "--event-full-width": `${dayWidth}%`,
                left: `${blockLeft}%`,
                top: `${top}%`,
                width: `calc(${blockWidth}% - 6px)`,
                height: `${height}%`,
                zIndex: isOverlapped ? block.laneCount - block.lane + 1 : 1,
              } as CSSProperties;

              return (
                <article
                  className={[
                    "calendar-event",
                    block.source === "google" ? "google-event" : "todo-event",
                    isOverlapped ? "calendar-event-overlap" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={eventStyle}
                  tabIndex={0}
                  key={`${block.source}-${block.day}-${block.id}-${index}`}
                  title={`${block.title} ${formatTimeRange(block.startMinutes, block.endMinutes)}`}
                >
                  <strong>{block.title}</strong>
                  <span>{formatTimeRange(block.startMinutes, block.endMinutes)}</span>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      <p className="calendar-import-note">
        Google Calendar：已导入 {importedCount} 项，只读显示，不会回写。
      </p>
    </aside>
  );
}

function DayCalendar({
  blocks,
  isExpanded = false,
  onClose,
  onExpand,
  selectedDate,
}: {
  blocks: WeekBlock[];
  isExpanded?: boolean;
  onClose?: () => void;
  onExpand?: () => void;
  selectedDate: string;
}) {
  const startHour = 8;
  const endHour = 22;
  const dayStart = startHour * 60;
  const dayMinutes = (endHour - startHour) * 60;
  const laidOutBlocks = layoutWeekBlocks(
    blocks.filter((block) => block.day === selectedDate),
    [selectedDate],
  );

  return (
    <aside className={isExpanded ? "day-panel day-panel-expanded" : "day-panel"} aria-label="今天日历">
      <div className="week-header">
        <div>
          <strong>今天</strong>
          <span>{selectedDate}</span>
        </div>
        {isExpanded ? (
          <button className="mini-button" type="button" onClick={onClose}>
            关闭
          </button>
        ) : (
          <button className="mini-button icon-button" type="button" onClick={onExpand} aria-label="放大今天日历">
            ↗
          </button>
        )}
      </div>
      <div className="day-grid-view">
        <div className="day-grid-head">
          <span />
          <strong>{parseIsoDate(selectedDate).toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}</strong>
        </div>
        <div className="week-grid-body">
          <div className="week-time-axis">
            {Array.from({ length: endHour - startHour + 1 }, (_, index) => (
              <span key={index}>{formatHourLabel(startHour + index)}</span>
            ))}
          </div>
          <div className="week-days-body day-body">
            {laidOutBlocks.length === 0 ? <p className="day-empty">今天还没有计时块。</p> : null}
            {laidOutBlocks.map((block, index) => {
              const clippedStart = Math.max(dayStart, block.startMinutes);
              const clippedEnd = Math.min(endHour * 60, block.endMinutes);
              const top = ((clippedStart - dayStart) / dayMinutes) * 100;
              const height = Math.max(0.7, ((clippedEnd - clippedStart) / dayMinutes) * 100);
              const left = block.laneOffset * 100;
              const width = block.laneWidth * 100;
              const isOverlapped = block.laneCount > 1;
              const eventStyle = {
                "--event-full-left": "0%",
                "--event-full-width": "100%",
                left: `${left}%`,
                top: `${top}%`,
                width: `calc(${width}% - 6px)`,
                height: `${height}%`,
                zIndex: isOverlapped ? block.laneCount - block.lane + 1 : 1,
              } as CSSProperties;

              return (
                <article
                  className={[
                    "calendar-event",
                    block.source === "google" ? "google-event" : "todo-event",
                    isOverlapped ? "calendar-event-overlap" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={eventStyle}
                  tabIndex={0}
                  key={`${block.source}-${block.day}-${block.id}-${index}`}
                  title={`${block.title} ${formatTimeRange(block.startMinutes, block.endMinutes)}`}
                >
                  <strong>{block.title}</strong>
                  <span>{formatTimeRange(block.startMinutes, block.endMinutes)}</span>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
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
