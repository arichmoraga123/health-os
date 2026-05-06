import {
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").unique(),
  ouraToken: text("oura_token"),
  name: text("name"),
  avatarInitials: text("avatar_initials"),
  homeTimezone: text("home_timezone"),
  currentTimezone: text("current_timezone"),
  pushSubscription: jsonb("push_subscription"),
  phoneNumber: text("phone_number"),
  phoneVerified: boolean("phone_verified").default(false),
  morningMessageTime: text("morning_message_time").default("10:00"),
  eveningCallTime: text("evening_call_time").default("21:00"),
  smsEnabled: boolean("sms_enabled").default(true),
  emailEnabled: boolean("email_enabled").default(true),
  eveningCallEnabled: boolean("evening_call_enabled").default(true),
  nightlyEmailEnabled: boolean("nightly_email_enabled").default(true),
  notificationEmail: text("notification_email"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const dailySnapshots = pgTable("daily_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  date: date("date").notNull(),
  sleepScore: integer("sleep_score"),
  readinessScore: integer("readiness_score"),
  activityScore: integer("activity_score"),
  hrv: integer("hrv"),
  sleepDuration: integer("sleep_duration"),
  deepSleep: integer("deep_sleep"),
  remSleep: integer("rem_sleep"),
  lightSleep: integer("light_sleep"),
  awakeTime: integer("awake_time"),
  timeInBed: integer("time_in_bed"),
  bedtimeStart: timestamp("bedtime_start", { withTimezone: true }),
  bedtimeEnd: timestamp("bedtime_end", { withTimezone: true }),
  efficiency: integer("efficiency"),
  latency: integer("latency"),
  averageBreath: real("average_breath"),
  lowestHeartRate: integer("lowest_heart_rate"),
  averageHeartRate: integer("average_heart_rate"),
  maxHeartRate: integer("max_heart_rate"),
  minSpo2: real("min_spo2"),
  avgSpo2: real("avg_spo2"),
  inactivityAlerts: integer("inactivity_alerts"),
  averageMetMinutes: real("average_met_minutes"),
  targetCalories: integer("target_calories"),
  targetMeters: integer("target_meters"),
  stressHigh: integer("stress_high"),
  recoveryHigh: integer("recovery_high"),
  stressSummary: text("stress_summary"),
  resilienceLevel: text("resilience_level"),
  resilienceSleepRecovery: real("resilience_sleep_recovery"),
  resilienceDaytimeRecovery: real("resilience_daytime_recovery"),
  resilienceStressBalance: real("resilience_stress_balance"),
  optimalBedtimeStart: text("optimal_bedtime_start"),
  optimalBedtimeEnd: text("optimal_bedtime_end"),
  hrvBalance: integer("hrv_balance"),
  recoveryIndex: integer("recovery_index"),
  restingHeartRateScore: integer("resting_heart_rate_score"),
  bodyTemperatureScore: integer("body_temperature_score"),
  activityBalance: integer("activity_balance"),
  sleepBalance: integer("sleep_balance"),
  previousDayActivity: integer("previous_day_activity"),
  previousNightScore: integer("previous_night_score"),
  stayActiveScore: integer("stay_active_score"),
  moveEveryHourScore: integer("move_every_hour_score"),
  meetDailyTargetsScore: integer("meet_daily_targets_score"),
  trainingFrequencyScore: integer("training_frequency_score"),
  trainingVolumeScore: integer("training_volume_score"),
  recoveryTimeScore: integer("recovery_time_score"),
  tags: jsonb("tags"),
  sleepPhase5Min: jsonb("sleep_phase_5_min"),
  hrv5Min: jsonb("hrv_5_min"),
  restfulness: integer("restfulness"),
  timing: integer("timing"),
  steps: integer("steps"),
  activeCalories: integer("active_calories"),
  totalCalories: integer("total_calories"),
  walkingDistance: real("walking_distance"),
  highActivityTime: integer("high_activity_time"),
  sedentaryTime: integer("sedentary_time"),
  bodyTempDeviation: real("body_temp_deviation"),
  rawSleep: jsonb("raw_sleep"),
  rawReadiness: jsonb("raw_readiness"),
  rawActivity: jsonb("raw_activity"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const dailyAiBriefs = pgTable("daily_ai_briefs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  date: date("date").notNull(),
  briefMarkdown: text("brief_markdown"),
  keyInsight: text("key_insight"),
  actionItems: text("action_items").array(),
  moodPrompt: text("mood_prompt"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const journalEntries = pgTable("journal_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  date: date("date").notNull(),
  prompt: text("prompt"),
  entry: text("entry"),
  sleepScoreThatDay: integer("sleep_score_that_day"),
  readinessScoreThatDay: integer("readiness_score_that_day"),
  hrvThatDay: integer("hrv_that_day"),
  aiReflection: text("ai_reflection"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const communities = pgTable("communities", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  inviteCode: text("invite_code").unique().notNull(),
  createdBy: uuid("created_by")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const communityMembers = pgTable("community_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  communityId: uuid("community_id")
    .references(() => communities.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  role: text("role"),
  isPublic: boolean("is_public").default(true),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow(),
});

export const communityPosts = pgTable("community_posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  communityId: uuid("community_id")
    .references(() => communities.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  content: text("content").notNull(),
  parentId: uuid("parent_id"),
  reactions: jsonb("reactions"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const nudges = pgTable("nudges", {
  id: uuid("id").defaultRandom().primaryKey(),
  fromUserId: uuid("from_user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  toUserId: uuid("to_user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  communityId: uuid("community_id")
    .references(() => communities.id, { onDelete: "cascade" })
    .notNull(),
  type: text("type").notNull(),
  message: text("message"),
  seen: boolean("seen").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const challenges = pgTable("challenges", {
  id: uuid("id").defaultRandom().primaryKey(),
  communityId: uuid("community_id")
    .references(() => communities.id, { onDelete: "cascade" })
    .notNull(),
  createdBy: uuid("created_by")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  type: text("type").notNull(),
  targetValue: integer("target_value").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const challengeParticipants = pgTable("challenge_participants", {
  id: uuid("id").defaultRandom().primaryKey(),
  challengeId: uuid("challenge_id")
    .references(() => challenges.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  currentValue: integer("current_value").default(0),
  completed: boolean("completed").default(false),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow(),
});

export const googleCalendarTokens = pgTable("google_calendar_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiry: timestamp("expiry", { withTimezone: true }),
});

export const calendarEvents = pgTable("calendar_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  googleEventId: text("google_event_id"),
  title: text("title"),
  startTime: timestamp("start_time", { withTimezone: true }),
  endTime: timestamp("end_time", { withTimezone: true }),
  isLateEvening: boolean("is_late_evening"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const timezonePlans = pgTable("timezone_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  homeTz: text("home_tz"),
  currentTz: text("current_tz"),
  offsetHours: real("offset_hours"),
  planMarkdown: text("plan_markdown"),
  tripMeta: jsonb("trip_meta"),
  structuredPlan: jsonb("structured_plan"),
  lightExposureTimes: jsonb("light_exposure_times"),
  targetSleepTime: text("target_sleep_time"),
  targetWakeTime: text("target_wake_time"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow(),
});

export const messagesLog = pgTable("messages_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  type: text("type").notNull(),
  content: text("content").notNull(),
  status: text("status").notNull(),
  error: text("error"),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow(),
});

export const aiConversations = pgTable("ai_conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  date: date("date").notNull(),
  title: text("title"),
  messages: jsonb("messages").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
