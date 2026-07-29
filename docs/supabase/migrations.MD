# Database Migrations

How to manage schema migrations for your Supabase project.

Database migrations are SQL statements that create, update, or delete your existing database schemas. They are a common way of tracking changes to your database over time.

## Schema migrations

For this guide, we'll create a table called `employees` and see how we can make changes to it.

You will need to [install](https://supabase.com/docs/guides/local-development#quickstart) the Supabase CLI and start the local development stack.

Tip: If a lock timeout error occurs, in your migration file, consider increasing your [`lock_timeout`](https://postgresqlco.nf/doc/en/param/lock_timeout/) setting.

1. **Create your first migration file**

To get started, generate a [new migration](https://supabase.com/docs/reference/cli/supabase-migration-new) to store the SQL needed to create our `employees` table.

```bash name=Terminal
supabase migration new create_employees_table
```

2. **Add the SQL to your migration file**

This creates a new migration file in supabase/migrations directory.

To that file, add the SQL to create this `employees` table.

```sql name=supabase/migrations/<timestamp>_create_employees_table.sql
create table if not exists employees (
  id bigint primary key generated always as identity,
  name text not null,
  email text,
  created_at timestamptz default now()
);
```

3. **Apply your first migration**

Run this migration to create the `employees` table.

Now you can visit your new `employees` table in the local Dashboard.

```bash name=Terminal
supabase migration up
```

4. **Modify your employees table**

Next, modify your `employees` table by adding a column for `department`.

```bash name=Terminal
supabase migration new add_department_column
```

5. **Add a new column to your table**

To that new migration file, add the SQL to create a new `department` column.

```sql name=supabase/migrations/<timestamp>_add_department_column.sql
alter table if exists public.employees
add department text default 'Hooli';
```

6. **Apply your second migration**

Run this migration to update your existing `employees` table.

```bash name=Terminal
supabase migration up
```

Finally, you should see the `department` column added to your `employees` table in the local Dashboard.

Note: View the [complete code](https://github.com/supabase/supabase/tree/master/examples/database/employees) for this example on GitHub.

### Seeding data

Now that you are managing your database with migrations, it would be great have some seed data to use every time you reset the database.

1. **Populate your table**

Create a seed script in supabase/seed.sql.

To that file, add the SQL to insert data into your `employees` table.

```sql name=supabase/seed.sql
insert into public.employees
  (name)
values
  ('Erlich Bachman'),
  ('Richard Hendricks'),
  ('Monica Hall');
```

2. **Reset your database**

Reset your database to reapply migrations and populate with seed data.

```bash name=Terminal
supabase db reset
```

You should now see the `employees` table, along with your seed data in the Dashboard! All of your database changes are captured in code, and you can reset to a known state at any time, complete with seed data.

### Diffing changes

This workflow is great if you know SQL and are comfortable creating tables and columns. If not, you can still use the Dashboard to create tables and columns, and then use the CLI to diff your changes and create migrations.

Caution: Only use the Dashboard to make schema changes on your **local** database, then capture them with `supabase db diff`. Making schema changes directly on your **remote** database (via the SQL editor or Table Editor) bypasses the migration history and will cause `db push` to fail with sync errors. Once you're using migrations, all schema changes to your remote database should go through migration files only.

1. **Create your table from the Dashboard**

Create a new table called `cities`, with columns `id`, `name` and `population`.

Then generate a [schema diff](https://supabase.com/docs/reference/cli/supabase-db-diff).

```bash name=Terminal
supabase db diff -f create_cities_table
```

2. **Add schema diff as a migration**

A new migration file is created for you.

Alternately, you can copy the table definitions directly from the Table Editor.

```sql name=supabase/migrations/<timestamp>_create_cities_table.sql
create table "public"."cities" (
  "id" bigint primary key generated always as identity,
  "name" text,
  "population" bigint
);
```

3. **Test your migration**

Test your new migration file by resetting your local database.

```bash name=Terminal
supabase db reset
```

The last step is deploying these changes to a live Supabase project.

## Deploy your project

You've been developing your project locally, making changes to your tables via migrations. It's time to deploy your project to the Supabase Platform and start scaling up to millions of users!

Head over to [Supabase](https://supabase.com/dashboard) and create a new project to deploy to.

1. **Log in to the Supabase CLI**

[Login](https://supabase.com/docs/reference/cli/supabase-login) to the Supabase CLI using an auto-generated Personal Access Token.

```bash name=Terminal
supabase login
```

2. **Link your project**

[Link](https://supabase.com/docs/reference/cli/supabase-link) to your remote project by selecting from the on-screen prompt.

```bash name=Terminal
supabase link
```

3. **Deploy database migrations**

[Push](https://supabase.com/docs/reference/cli/supabase-db-push) your migrations to the remote database.

```bash name=Terminal
supabase db push
```

4. **Deploy database seed data (optional)**

[Push](https://supabase.com/docs/reference/cli/supabase-db-push) your migrations and seed the remote database.

```bash name=Terminal
supabase db push --include-seed
```

Visiting your live project on [Supabase](https://supabase.com/dashboard/project/_), you'll see a new `employees` table, complete with the `department` column you added in the second migration above.

## Working with a team

When multiple developers share a Supabase project, a few rules keep migrations from getting out of sync.

**The golden rule: never change the remote database directly.** Once you're using migrations, all schema changes — even small ones — should go through migration files. Using the Dashboard's SQL editor or Table Editor on your remote database bypasses the migration history, and `db push` will start failing with sync errors.

**The team workflow:**

1. **Create a migration locally**

Each developer creates migration files on their own branch, never touching the remote database directly.

```bash name=Terminal
supabase migration new your_change_description
```

2. **Test and commit**

Reset your local database to apply the migration, then commit the migration file to git.

```bash name=Terminal
supabase db reset
git add supabase/migrations
git commit -m "add migration: your_change_description"
```

3. **Pull and reset when a teammate merges a migration**

After pulling new migration files from git, reset your local database to apply them.

```bash name=Terminal
git pull
supabase db reset
```

4. **One person deploys to remote**

Coordinate so only one person runs `db push` at a time. Migration files are applied in timestamp order, so concurrent pushes from different machines can cause conflicts.

```bash name=Terminal
supabase db push
```

Tip: For a more automated deployment approach, consider using [Supabase Branching](https://supabase.com/docs/guides/deployment/branching) or a CI/CD pipeline that runs `supabase db push` on merge to your main branch.

## Diagnosing and fixing sync errors

If `db push` fails with errors suggesting you run `supabase migration repair`, your local migration files and the remote database's migration history are out of sync. Here's how to diagnose and fix it.

### How migration tracking works

Supabase tracks which migrations have been applied on each database in a table called `supabase_migrations.schema_migrations`. When you run `supabase db push`, it compares your local `supabase/migrations` folder against that table and runs only the ones not yet applied, in order.

Git tracks your migration *files*. Supabase tracks what's been *applied to each database*. These are two separate systems that need to stay in sync.

### Step 1: Check what's out of sync

Start by listing the migration status across local and remote:

```bash name=Terminal
supabase migration list
```

This shows which migrations are applied locally, which are applied on the remote, and where they diverge.

### Step 2: If you made changes on the remote database directly

Pull the current remote state into a migration file to get back in sync:

```bash name=Terminal
supabase db pull
```

This creates a new migration file capturing the current remote schema. Commit it to git, then follow the standard workflow going forward.

### Step 3: If the migration history table is wrong

If a migration shows as missing in the remote history table but the schema change is already there (for example, it was applied manually), you can mark it as applied without re-running it:

```bash name=Terminal
supabase migration repair --status applied <migration-timestamp>
```

Or if a migration is recorded as applied but was never run:

```bash name=Terminal
supabase migration repair --status reverted <migration-timestamp>
```

Caution: `migration repair` updates the tracking table only — it does not apply or revert any SQL. Use it to correct the history record when you know the actual database state is correct.
