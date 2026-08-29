import { supabaseAdmin } from "@/integrations/supabase/client.server";

const db = supabaseAdmin as any;
const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;

function iso(ms: number) {
  return new Date(ms).toISOString();
}

function semverParts(value: string) {
  return String(value || "0").split(/[+-]/, 1)[0]!.split(".").map((part) => Number(part) || 0).slice(0, 4);
}
function compareVersions(a: string, b: string) {
  const aa = semverParts(a);
  const bb = semverParts(b);
  for (let index = 0; index < Math.max(aa.length, bb.length, 3); index += 1) {
    const diff = (aa[index] ?? 0) - (bb[index] ?? 0);
    if (diff) return diff;
  }
  return 0;
}

function dayKey(value: string | number | Date) {
  return new Date(value).toISOString().slice(0, 10);
}

function countBy<T>(rows: T[], key: (row: T) => string | null | undefined) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const value = key(row) || "Não informado";
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function seriesDays(days: number) {
  const now = Date.now();
  return Array.from({ length: days }, (_, index) => dayKey(now - (days - 1 - index) * DAY));
}

async function profilesFor(userIds: string[]) {
  const rows: any[] = [];
  for (let index = 0; index < userIds.length; index += 150) {
    const chunk = userIds.slice(index, index + 150);
    if (!chunk.length) continue;
    const { data } = await db.from("profiles").select("id,name,email").in("id", chunk);
    rows.push(...(data ?? []));
  }
  return rows;
}

async function licensesFor(userIds: string[]) {
  const rows: any[] = [];
  for (let index = 0; index < userIds.length; index += 100) {
    const chunk = userIds.slice(index, index + 100);
    if (!chunk.length) continue;
    const { data } = await db
      .from("licenses")
      .select("id,user_id,plan_id,status,expires_at,type,updated_at,plans(name,slug)")
      .in("user_id", chunk)
      .order("updated_at", { ascending: false });
    rows.push(...(data ?? []));
  }
  return rows;
}

function healthStatus(events: any[], errors: any[], matcher: (event: any, error: any | null) => boolean) {
  const relevantEvents = events.filter((event) => matcher(event, null));
  const relevantErrors = errors.filter((error) => matcher(null, error));
  const failedEvents = relevantEvents.filter((event) => event.status === "failed").length;
  const failures = failedEvents + relevantErrors.length;
  const successes = relevantEvents.filter((event) => event.status === "success").length;
  const total = failures + successes;
  const failureRate = total ? failures / total : 0;
  if ((failures >= 5 && failureRate >= 0.5) || failures >= 20) return { level: "problem", label: "Problema detectado", failures, total };
  if (failures >= 3 || (total >= 5 && failureRate >= 0.2)) return { level: "unstable", label: "Instabilidade", failures, total };
  return { level: "operational", label: "Operacional", failures, total };
}

function userTimeline(events: any[], userId: string, limit = 30) {
  return events
    .filter((event) => event.user_id === userId)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, limit);
}

export async function loadExtensionAdminCenter() {
  const now = Date.now();
  const since30d = iso(now - 30 * DAY);
  const since7d = iso(now - 7 * DAY);
  const since24h = iso(now - DAY);
  const since30m = iso(now - 30 * 60_000);
  const today = dayKey(now);

  const [installationsRes, projectsRes, eventsRes, errorsRes, releasesRes, incidentsRes, alertsRes] = await Promise.all([
    db.from("extension_installations").select("*").order("last_seen_at", { ascending: false }).limit(3000),
    db.from("extension_projects").select("*").order("last_activity_at", { ascending: false }).limit(3000),
    db.from("extension_events").select("*").gte("created_at", since30d).order("created_at", { ascending: false }).limit(10000),
    db.from("extension_errors").select("*").gte("created_at", since30d).order("created_at", { ascending: false }).limit(5000),
    db.from("extension_releases").select("*").order("created_at", { ascending: false }).limit(200),
    db.from("extension_incidents").select("*").order("last_seen_at", { ascending: false }).limit(200),
    db.from("extension_alerts").select("*").order("created_at", { ascending: false }).limit(200),
  ]);

  const installations = installationsRes.data ?? [];
  const projects = projectsRes.data ?? [];
  const events = eventsRes.data ?? [];
  const errors = errorsRes.data ?? [];
  const releases = releasesRes.data ?? [];
  const incidents = incidentsRes.data ?? [];
  const alerts = alertsRes.data ?? [];
  const userIds = [...new Set(installations.map((row: any) => row.user_id).filter(Boolean))] as string[];
  const [profiles, licenses] = await Promise.all([profilesFor(userIds), licensesFor(userIds)]);
  const profileMap = new Map(profiles.map((profile: any) => [profile.id, profile]));

  const released = releases.filter((release: any) => release.status === "released").sort((a: any, b: any) => Date.parse(b.released_at || b.created_at) - Date.parse(a.released_at || a.created_at));
  const latestRelease = released[0] ?? null;
  const minimumVersion = latestRelease?.minimum_version || latestRelease?.version || null;
  const online = installations.filter((row: any) => Date.parse(row.last_seen_at) >= now - 5 * 60_000);
  const activeTodayUsers = new Set(installations.filter((row: any) => dayKey(row.last_seen_at) === today).map((row: any) => row.user_id));
  const active7dUsers = new Set(installations.filter((row: any) => Date.parse(row.last_seen_at) >= now - 7 * DAY).map((row: any) => row.user_id));
  const oldVersionUsers = new Set(
    installations
      .filter((row: any) => minimumVersion && compareVersions(row.version, minimumVersion) < 0)
      .map((row: any) => row.user_id),
  );
  const commandsToday = events.filter((event: any) => event.action === "prompt_sent" && dayKey(event.created_at) === today).length;
  const errors24h = errors.filter((error: any) => Date.parse(error.created_at) >= now - DAY);
  const critical24h = errors24h.filter((error: any) => error.severity === "critical" && !error.resolved);
  const terminal = events.filter((event: any) => event.status === "success" || event.status === "failed");
  const successRate = terminal.length ? (terminal.filter((event: any) => event.status === "success").length / terminal.length) * 100 : 100;
  const versionDistribution = countBy(installations, (row: any) => row.version);
  const mostUsedVersion = versionDistribution[0]?.name ?? "—";

  const days = seriesDays(14);
  const activeUsersByDay = days.map((day) => ({
    day: day.slice(5),
    users: new Set(events.filter((event: any) => dayKey(event.created_at) === day).map((event: any) => event.user_id)).size,
  }));
  const commandsByDay = days.map((day) => ({
    day: day.slice(5),
    commands: events.filter((event: any) => event.action === "prompt_sent" && dayKey(event.created_at) === day).length,
  }));

  const connectedActionUsers = (action: string) => new Set(events.filter((event: any) => event.action === action && event.status === "success" && Date.parse(event.created_at) >= now - 7 * DAY).map((event: any) => event.user_id)).size;

  const clientRows = userIds.map((userId) => {
    const userInstallations = installations.filter((row: any) => row.user_id === userId);
    const userProjects = projects.filter((row: any) => row.user_id === userId);
    const userErrors = errors.filter((row: any) => row.user_id === userId);
    const userEvents = events.filter((row: any) => row.user_id === userId);
    const userLicenses = licenses.filter((row: any) => row.user_id === userId);
    const activeLicense = userLicenses.find((row: any) => row.status === "active" && (!row.expires_at || Date.parse(row.expires_at) > now)) ?? userLicenses[0] ?? null;
    const latestInstall = userInstallations.sort((a: any, b: any) => Date.parse(b.last_seen_at) - Date.parse(a.last_seen_at))[0];
    const providers = [...new Set(userProjects.map((row: any) => row.provider).filter(Boolean))];
    const profile = profileMap.get(userId) as any;
    return {
      user_id: userId,
      name: profile?.name ?? "Cliente",
      email: profile?.email ?? "—",
      plan: activeLicense?.plans?.name ?? activeLicense?.plans?.slug ?? "—",
      license_id: activeLicense?.id ?? null,
      license_status: activeLicense?.status ?? "—",
      expires_at: activeLicense?.expires_at ?? null,
      installations: userInstallations,
      installation_count: userInstallations.length,
      online: userInstallations.some((row: any) => Date.parse(row.last_seen_at) >= now - 5 * 60_000),
      version: latestInstall?.version ?? "—",
      browser: latestInstall?.browser ?? "—",
      os: latestInstall?.os ?? "—",
      last_activity_at: latestInstall?.last_activity_at ?? latestInstall?.last_seen_at ?? null,
      projects: userProjects,
      project_count: userProjects.length,
      providers,
      commands: userEvents.filter((row: any) => row.action === "prompt_sent").length,
      errors: userErrors.length,
      timeline: userTimeline(events, userId, 30),
      versions: [...new Set(userInstallations.map((row: any) => row.version))],
    };
  });

  const projectRows = projects.map((project: any) => ({
    ...project,
    client: profileMap.get(project.user_id) ?? null,
    timeline: events
      .filter((event: any) => event.user_id === project.user_id && event.project_id === project.lovable_project_id)
      .sort((a: any, b: any) => Date.parse(a.created_at) - Date.parse(b.created_at))
      .slice(-80),
  }));

  const recentEvents = events.slice(0, 500);
  const recentErrors = errors.slice(0, 500).map((error: any) => ({ ...error, client: profileMap.get(error.user_id) ?? null }));
  const recent30mEvents = events.filter((event: any) => Date.parse(event.created_at) >= Date.parse(since30m));
  const recent30mErrors = errors.filter((error: any) => Date.parse(error.created_at) >= Date.parse(since30m));

  const serviceMatchers: Record<string, (event: any, error: any | null) => boolean> = {
    GitHub: (event, error) => error ? error.provider === "github" || String(error.action || "").startsWith("github_") : event.provider === "github" || String(event.action || "").startsWith("github_"),
    "ChatGPT Bridge": (event, error) => error ? error.provider === "chatgpt" : event.provider === "chatgpt" || String(event.action || "").startsWith("chatgpt_"),
    "Grok Bridge": (event, error) => error ? error.provider === "grok" : event.provider === "grok" || String(event.action || "").startsWith("grok_"),
    "BLACKBOX Bridge": (event, error) => error ? error.provider === "blackbox" : event.provider === "blackbox" || String(event.action || "").startsWith("blackbox_"),
    Lovable: (event, error) => error ? error.provider === "lovable" || /lovable|preview|publish/i.test(String(error.action || "")) : event.provider === "lovable" || /lovable|preview|publish/i.test(String(event.action || "")),
    "Backend MSK": (event, error) => error ? /BACKEND|TELEMETRY|HEARTBEAT/i.test(String(error.error_code || "")) : String(event.action || "") === "extension_started",
    Licenças: (_event, error) => !!error && /^LICENSE_/.test(String(error.error_code || "")),
  };
  const health = Object.entries(serviceMatchers).map(([service, matcher]) => ({ service, ...healthStatus(recent30mEvents, recent30mErrors, matcher) }));

  const versionRows = releases.map((release: any) => {
    const versionInstalls = installations.filter((row: any) => row.version === release.version);
    const versionEvents = events.filter((row: any) => row.extension_version === release.version && (row.status === "success" || row.status === "failed"));
    const versionFailures = versionEvents.filter((row: any) => row.status === "failed").length + errors.filter((row: any) => row.extension_version === release.version).length;
    const denominator = Math.max(versionEvents.length, 1);
    return {
      ...release,
      users: new Set(versionInstalls.map((row: any) => row.user_id)).size,
      installations: versionInstalls.length,
      error_rate: Math.min(100, (versionFailures / denominator) * 100),
    };
  });

  const releaseComparisons = released.slice(0, 2).map((release: any) => {
    const rows = events.filter((event: any) => event.extension_version === release.version && (event.status === "success" || event.status === "failed"));
    const success = rows.filter((event: any) => event.status === "success").length;
    return { version: release.version, success_rate: rows.length ? (success / rows.length) * 100 : 100, operations: rows.length };
  });

  return {
    generated_at: new Date().toISOString(),
    stats: {
      installed: installations.length,
      online_now: online.length,
      clients_today: activeTodayUsers.size,
      clients_7d: active7dUsers.size,
      most_used_version: mostUsedVersion,
      old_version_clients: oldVersionUsers.size,
      commands_today: commandsToday,
      projects_connected: projects.length,
      github_connected: new Set(projects.filter((project: any) => project.github_status === "connected").map((project: any) => project.user_id)).size,
      chatgpt_connected: connectedActionUsers("chatgpt_connected"),
      grok_connected: connectedActionUsers("grok_connected"),
      blackbox_connected: connectedActionUsers("blackbox_connected"),
      errors_24h: errors24h.length,
      critical_errors: critical24h.length,
      success_rate: Number(successRate.toFixed(2)),
    },
    charts: {
      active_users: activeUsersByDay,
      commands: commandsByDay,
      errors_by_version: countBy(errors24h, (row: any) => row.extension_version).slice(0, 12),
      errors_by_provider: countBy(errors24h, (row: any) => row.provider).slice(0, 12),
      errors_by_browser: countBy(errors24h, (row: any) => row.browser).slice(0, 12),
      errors_by_stage: countBy(errors24h, (row: any) => row.action).slice(0, 12),
      installations_by_version: versionDistribution.slice(0, 16),
    },
    clients: clientRows.sort((a, b) => Date.parse(b.last_activity_at || "1970-01-01") - Date.parse(a.last_activity_at || "1970-01-01")),
    installations,
    projects: projectRows,
    errors: recentErrors,
    activity: recentEvents,
    incidents,
    alerts,
    releases: versionRows,
    latest_release: latestRelease,
    minimum_version: minimumVersion,
    health,
    comparison: releaseComparisons,
    retention: { events_days: 90, errors_days: 180, releases: "permanente" },
  };
}

export async function resolveExtensionError(errorId: string, resolved: boolean) {
  const { data, error } = await db
    .from("extension_errors")
    .update({ resolved, resolved_at: resolved ? new Date().toISOString() : null })
    .eq("id", errorId)
    .select("id,resolved,resolved_at")
    .single();
  if (error) throw new Error(error.message);
  return { ok: true, error: data };
}

export async function resolveExtensionIncident(incidentId: string, resolved: boolean) {
  const { data, error } = await db
    .from("extension_incidents")
    .update({ status: resolved ? "resolved" : "monitoring", resolved_at: resolved ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("id", incidentId)
    .select("id,status,resolved_at")
    .single();
  if (error) throw new Error(error.message);
  return { ok: true, incident: data };
}

export async function saveExtensionRelease(input: {
  version: string;
  title: string;
  changelog: string;
  buildId?: string | null;
  mandatory: boolean;
  minimumVersion?: string | null;
  downloadUrl?: string | null;
  status: "draft" | "testing" | "released" | "deprecated";
}, adminId: string) {
  if (input.downloadUrl && !/^https:\/\/msksystem\.online\//i.test(input.downloadUrl)) {
    throw new Error("O link de download precisa usar a fonte oficial msksystem.online.");
  }
  const payload = {
    version: input.version,
    title: input.title,
    changelog: input.changelog,
    build_id: input.buildId ?? null,
    mandatory: input.mandatory,
    minimum_version: input.minimumVersion || input.version,
    download_url: input.downloadUrl || null,
    status: input.status,
    released_at: input.status === "released" ? new Date().toISOString() : null,
    updated_by: adminId,
    updated_at: new Date().toISOString(),
  };
  const { data: existing } = await db.from("extension_releases").select("id,released_at").eq("version", input.version).maybeSingle();
  let result;
  if (existing?.id) {
    const patch = { ...payload, released_at: input.status === "released" ? (existing.released_at || payload.released_at) : null };
    const response = await db.from("extension_releases").update(patch).eq("id", existing.id).select("*").single();
    if (response.error) throw new Error(response.error.message);
    result = response.data;
  } else {
    const response = await db.from("extension_releases").insert(payload).select("*").single();
    if (response.error) throw new Error(response.error.message);
    result = response.data;
  }
  let notified = 0;
  if (input.status === "released") {
    try {
      const { broadcastUpdateNotice } = await import("./extension-remote-control.server");
      const outcome = await broadcastUpdateNotice(
        { version: input.version, downloadUrl: input.downloadUrl || null, mandatory: input.mandatory },
        adminId,
      );
      notified = outcome.deliveries;
    } catch {
      notified = 0;
    }
  }

  return { ok: true, release: result, notified };
}

export async function acknowledgeExtensionAlert(alertId: string, adminId: string) {
  const { error } = await db
    .from("extension_alerts")
    .update({ acknowledged: true, acknowledged_by: adminId, acknowledged_at: new Date().toISOString() })
    .eq("id", alertId);
  if (error) throw new Error(error.message);
  return { ok: true };
}
