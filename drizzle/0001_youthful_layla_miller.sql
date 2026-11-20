CREATE TYPE "public"."etl_run_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."period_type" AS ENUM('day', 'week', 'month');--> statement-breakpoint
CREATE TABLE "areas" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "areas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code_scheme" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"level" text NOT NULL,
	"parent_id" integer,
	"boundary" geometry(MultiPolygon, 4326),
	"centroid" geography(Point,4326),
	CONSTRAINT "areas_code_scheme_code_key" UNIQUE("code_scheme","code"),
	CONSTRAINT "areas_level_check" CHECK ("areas"."level" in ('nation', 'region', 'upper_tier_local_authority', 'lower_tier_local_authority', 'country', 'other'))
);
--> statement-breakpoint
CREATE TABLE "diseases" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "diseases_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "diseases_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "etl_runs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "etl_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"source_id" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" "etl_run_status" DEFAULT 'running' NOT NULL,
	"row_count" integer,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "observations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "observations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"disease_id" integer NOT NULL,
	"area_id" integer NOT NULL,
	"source_id" integer NOT NULL,
	"metric" text NOT NULL,
	"stratum" text DEFAULT 'all' NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"period_type" "period_type" NOT NULL,
	"value" double precision NOT NULL,
	"retrieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "observations_natural_key" UNIQUE("source_id","disease_id","area_id","metric","stratum","period_type","period_start"),
	CONSTRAINT "observations_period_check" CHECK ("observations"."period_end" >= "observations"."period_start")
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sources_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"licence_name" text NOT NULL,
	"licence_url" text NOT NULL,
	"attribution" text NOT NULL,
	CONSTRAINT "sources_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "areas" ADD CONSTRAINT "areas_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "etl_runs" ADD CONSTRAINT "etl_runs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_disease_id_diseases_id_fk" FOREIGN KEY ("disease_id") REFERENCES "public"."diseases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "areas_parent_id_idx" ON "areas" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "areas_boundary_gist_idx" ON "areas" USING gist ("boundary");--> statement-breakpoint
CREATE INDEX "areas_centroid_gist_idx" ON "areas" USING gist ("centroid");--> statement-breakpoint
CREATE INDEX "etl_runs_source_started_idx" ON "etl_runs" USING btree ("source_id","started_at");--> statement-breakpoint
CREATE INDEX "observations_disease_period_idx" ON "observations" USING btree ("disease_id","period_start");--> statement-breakpoint
CREATE INDEX "observations_area_disease_period_idx" ON "observations" USING btree ("area_id","disease_id","period_start");