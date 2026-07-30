Migraciones de bases de datos

Cómo gestionar las migraciones de esquema para tu proyecto de Supabase.

Las migraciones de bases de datos son sentencias SQL que crean, actualizan o eliminan los esquemas de bases de datos existentes. Son una forma habitual de realizar un seguimiento de los cambios en la base de datos a lo largo del tiempo.

Migraciones de esquema #
Para esta guía, crearemos una tabla llamada employeesy veremos cómo podemos modificarla.

Deberás instalar la interfaz de línea de comandos de Supabase e iniciar el entorno de desarrollo local.

Si se produce un error de tiempo de espera de bloqueo en su archivo de migración, considere aumentar la configuración.lock_timeout

1
Crea tu primer archivo de migración
Para empezar, genere una nueva migración para almacenar el código SQL necesario para crear nuestra employeestabla.

Terminal


supabase migration new create_employees_table
2
Agregue el SQL a su archivo de migración.
Esto crea un nuevo archivo de migración en el directorio supabase/migrations.

A ese archivo, añade el código SQL para crear esta employeestabla.

supabase/migrations/<timestamp>_create_employees_table.sql


create table if not exists employees (
  id bigint primary key generated always as identity,
  name text not null,
  email text,
  created_at timestamptz default now()
);
3
Realiza tu primera migración
Ejecuta esta migración para crear la employeestabla.

Ahora puedes acceder a tu nueva employeestabla en el Panel de control local.

Terminal


supabase migration up
4
Modifica tu tabla de empleados
A continuación, modifique su employeestabla agregando una columna para department.

Terminal


supabase migration new add_department_column
5
Agregue una nueva columna a su tabla.
A ese nuevo archivo de migración, añada la consulta SQL para crear una nueva departmentcolumna.

supabase/migrations/<timestamp>_add_department_column.sql


alter table if exists public.employees
add department text default 'Hooli';
6
Aplica tu segunda migración
Ejecuta esta migración para actualizar tu employeestabla existente.

Terminal


supabase migration up
Finalmente, debería ver la departmentcolumna añadida a su employeestabla en el panel de control local.

Puedes ver el código completo de este ejemplo en GitHub.

Datos de inicialización #
Ahora que gestionas tu base de datos con migraciones, sería estupendo disponer de algunos datos de inicialización para usar cada vez que reinicies la base de datos.

1
Rellena tu tabla
Crea un script de semilla en supabase/seed.sql.

A ese archivo, añade el código SQL para insertar datos en tu employeestabla.

supabase/seed.sql


insert into public.employees
  (name)
values
  ('Erlich Bachman'),
  ('Richard Hendricks'),
  ('Monica Hall');
2
Restablecer la base de datos
Reinicia tu base de datos para volver a aplicar las migraciones y rellenarla con datos de ejemplo.

Terminal


supabase db reset
Ahora debería ver la employeestabla, junto con sus datos iniciales, en el Panel de control. Todos los cambios en su base de datos se registran en el código, y puede restablecerla a un estado conocido en cualquier momento, incluyendo los datos iniciales.

Cambios de diferencia #
Este flujo de trabajo es ideal si conoces SQL y te sientes cómodo creando tablas y columnas. De lo contrario, puedes usar el Panel de control para crearlas y, a continuación, la interfaz de línea de comandos (CLI) para comparar los cambios y crear migraciones.

Utilice únicamente el Panel de control para realizar cambios de esquema en su base de datos local y, a continuación, captúrelos supabase db diff. Realizar cambios de esquema directamente en su base de datos remota (mediante el editor SQL o el editor de tablas) omite el historial de migraciones y provocará db pusherrores de sincronización. Una vez que utilice las migraciones, todos los cambios de esquema en su base de datos remota deberán realizarse únicamente a través de los archivos de migración.

1
Crea tu tabla desde el Panel de control
Crea una nueva tabla llamada cities, con las columnas id, namey population.

Luego genere una diferencia de esquema .

Terminal


supabase db diff -f create_cities_table
2
Agregar diff de esquema como una migración
Se ha creado un nuevo archivo de migración para usted.

Como alternativa, puede copiar las definiciones de tabla directamente desde el Editor de tablas.

supabase/migrations/<timestamp>_create_cities_table.sql


create table "public"."cities" (
  "id" bigint primary key generated always as identity,
  "name" text,
  "population" bigint
);
3
Prueba tu migración
Prueba tu nuevo archivo de migración reiniciando tu base de datos local.

Terminal


supabase db reset
El último paso consiste en implementar estos cambios en un proyecto de Supabase en producción.

Implementa tu proyecto #
Has estado desarrollando tu proyecto localmente, realizando cambios en tus tablas mediante migraciones. ¡Es hora de implementar tu proyecto en la plataforma Supabase y comenzar a escalar para dar servicio a millones de usuarios!

Dirígete a Supabase y crea un nuevo proyecto para desplegarlo.

1
Inicie sesión en la CLI de Supabase
Inicie sesión en la interfaz de línea de comandos de Supabase utilizando un token de acceso personal generado automáticamente.

Terminal


supabase login
2
Vincula tu proyecto
Conéctese a su proyecto remoto seleccionándolo en la pantalla.

Terminal


supabase link
3
Implementar migraciones de bases de datos
Envía tus migraciones a la base de datos remota.

Terminal


supabase db push
4
Implementar datos de inicialización de la base de datos (opcional)
Envía tus migraciones y carga la base de datos remota.

Terminal


supabase db push --include-seed
Al visitar tu proyecto en vivo en Supabase , verás una nueva employeestabla, con la departmentcolumna que agregaste en la segunda migración mencionada anteriormente.