# Instalación en Windows — Óptica Forever Vision

Guía completa para instalar el sistema en una PC con Windows 10/11 y dejarlo corriendo automáticamente al encender.

---

## Resumen rápido (checklist)

- [ ] 1. Instalar Git
- [ ] 2. Instalar Docker Desktop
- [ ] 3. Habilitar WSL2 (Windows Subsystem for Linux)
- [ ] 4. Clonar el repositorio
- [ ] 5. Crear el archivo `.env`
- [ ] 6. Construir e iniciar el sistema
- [ ] 7. Ejecutar migraciones de base de datos
- [ ] 8. Crear usuario administrador
- [ ] 9. Importar datos desde Excel
- [ ] 10. Configurar inicio automático con Windows

---

## Paso 1 — Instalar Git

1. Descargá Git desde: https://git-scm.com/download/win
2. Instalar con las opciones por defecto.
3. Verificar abriendo **Símbolo del sistema** y ejecutando:
   ```
   git --version
   ```

---

## Paso 2 — Instalar Docker Desktop

1. Descargá Docker Desktop desde: https://www.docker.com/products/docker-desktop/
2. Ejecutar el instalador (requiere reiniciar la PC).
3. Al abrir Docker Desktop por primera vez:
   - Aceptar los términos.
   - En **Settings → General**, marcar ✅ **"Start Docker Desktop when you sign in to Windows"**
   - En **Settings → General**, verificar que **"Use WSL 2 based engine"** esté activado.
4. Esperar a que el ícono de Docker en la barra de tareas quede en verde (puede tardar 1–2 minutos).

---

## Paso 3 — Habilitar WSL2 (si Docker lo pide)

Si Docker Desktop pide instalar WSL2, seguir estos pasos en PowerShell **como Administrador**:

```powershell
wsl --install
```

Reiniciar la PC y luego volver a abrir Docker Desktop.

---

## Paso 4 — Clonar el repositorio

Abrir **Símbolo del sistema** (cmd) o **PowerShell** y ejecutar:

```cmd
cd C:\
mkdir Optica
cd Optica
git clone https://github.com/TU_USUARIO/TU_REPO.git .
```

> Si el repositorio es privado, Git pedirá usuario y token de GitHub.
> El resultado final debe ser que la carpeta `C:\Optica\optica-forever-vision\` exista.

### Estructura esperada

```
C:\Optica\
└── optica-forever-vision\
    ├── backend\
    ├── frontend\
    ├── deploy\
    │   ├── docker-compose.prod.yml
    │   ├── nginx.prod.conf
    │   ├── .env.ejemplo
    │   └── iniciar-optica.bat
    └── tools\
        └── migrate_excel.py
```

---

## Paso 5 — Crear el archivo .env

1. Ir a la carpeta `deploy`:
   ```cmd
   cd C:\Optica\optica-forever-vision\deploy
   ```

2. Copiar el archivo de ejemplo:
   ```cmd
   copy .env.ejemplo .env
   ```

3. Abrir `.env` con el Bloc de notas y editar **al menos** estas variables:

   ```env
   DB_PASSWORD=UnaContrasenaMuySegura2024!
   REDIS_PASSWORD=OtraContrasenaRedis2024!
   JWT_SECRET=PegaAquiUnaCadenaMuyLargaYAleatoria...
   ```

   Para generar un JWT_SECRET seguro, en PowerShell ejecutar:
   ```powershell
   -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
   ```
   Copiar el resultado y pegarlo en `JWT_SECRET=`.

---

## Paso 6 — Construir e iniciar el sistema

En **Símbolo del sistema**, dentro de `C:\Optica\optica-forever-vision\deploy`:

```cmd
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

La primera vez tarda **5–15 minutos** descargando imágenes y compilando.  
Cuando termina, verificar que los contenedores estén corriendo:

```cmd
docker compose -f docker-compose.prod.yml ps
```

Deberías ver 4 servicios: `db`, `redis`, `backend`, `frontend` — todos en estado `running`.

Abrir el navegador en: **http://localhost**

---

## Paso 7 — Ejecutar migraciones de base de datos

Solo se hace **una vez** al instalar. Ejecutar en cmd desde la carpeta `deploy`:

```cmd
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

Si sale `INFO Running upgrade ... -> head` es correcto.

---

## Paso 8 — Crear el usuario administrador

```cmd
docker compose -f docker-compose.prod.yml exec backend python -c "
from app.core.db import SessionLocal
from app.models.user import User
from app.core.security import hash_password
db = SessionLocal()
u = User(email='admin@optica.com', full_name='Administrador', role='admin', password_hash=hash_password('Optica2026!'))
db.add(u)
db.commit()
print('Listo — email: admin@optica.com  /  pass: Optica2026!')
db.close()
"
```

> Podés cambiar `admin@optica.com` y `Optica2026!` por el email y contraseña que quieras usar para ingresar al sistema.

---

## Paso 9 — Importar datos desde Excel

### Archivos que necesitas

Copia estos archivos Excel al directorio donde vas a correr el script:

| Archivo | Qué contiene |
|---------|-------------|
| `OpticaRevisado.xlsm` | Pacientes, ventas, consultas, inventario, CxC |
| `Cuentas.xlsx` | Ingresos y egresos históricos |

### Instalar dependencias del script

```cmd
pip install openpyxl requests
```

> Si `pip` no funciona, instalar Python desde https://www.python.org/downloads/ marcando ✅ "Add to PATH"

### Ejecutar la migración

Abrir cmd y ejecutar **en orden**:

```cmd
cd C:\Optica\optica-forever-vision\tools

:: Paso 1: Importar pacientes
python migrate_excel.py --file "C:\ruta\OpticaRevisado.xlsm" --url http://localhost --solo pacientes --usuario admin --pass Optica2024!

:: Paso 2: Importar inventario de productos
python migrate_excel.py --file "C:\ruta\OpticaRevisado.xlsm" --url http://localhost --solo inventario --usuario admin --pass Optica2024!

:: Paso 3: Importar ventas (necesita que pacientes ya estén importados)
python migrate_excel.py --file "C:\ruta\OpticaRevisado.xlsm" --url http://localhost --solo ventas --usuario admin --pass Optica2024!
```

O en un solo comando (los 3 pasos juntos):

```cmd
python migrate_excel.py --file "C:\ruta\OpticaRevisado.xlsm" --url http://localhost --usuario admin --pass Optica2024!
```

### Verificar la migración

Abrir **http://localhost** y revisar:
- **Pacientes** → deben aparecer todos los registros de `bdPacientes`
- **Inventario** → productos de la hoja `Inventario`
- **Ventas** → historial de la hoja `cabezaVentas`

### Datos que NO se migran automáticamente

Estos los tendrás que cargar manualmente o pedirme un script adicional:

| Dato | Dónde cargarlo |
|------|---------------|
| Consultas (Rx histórico) | Paciente → Nueva consulta |
| Créditos / Cuentas x Cobrar | Módulo CxC |
| Cuentas bancarias | Configuración → Cuentas bancarias |
| Egresos históricos | Módulo Caja → Egresos |

---

## Paso 10 — Inicio automático con Windows

El sistema debe arrancar solo cada vez que se enciende la computadora. Son dos configuraciones:

### 10a. Docker Desktop inicia automático (ya configurado en Paso 2)

Docker Desktop arranca con Windows porque marcamos esa opción. Verificar en:
- **Docker Desktop → Settings → General → Start Docker Desktop when you sign in to Windows** ✅

### 10b. Los contenedores arrancan automáticos con Docker

Los contenedores en `docker-compose.prod.yml` tienen `restart: always`, lo que significa que Docker los reinicia automáticamente apenas Docker Desktop esté corriendo.

Sin embargo, hay un pequeño período donde Docker Desktop está iniciando y los contenedores aún no están listos. Para cubrirlo, configurar una tarea en el Programador de tareas:

#### Configurar el Programador de tareas

1. Presionar `Windows + R` → escribir `taskschd.msc` → Enter
2. En el panel derecho, clic en **"Crear tarea básica…"**
3. Completar:
   - **Nombre:** `Optica Forever Vision`
   - **Descripción:** `Inicia el sistema de gestión óptica`
4. **Desencadenador:** Al iniciar el equipo
5. **Acción:** Iniciar un programa
   - **Programa:** `C:\Optica\optica-forever-vision\deploy\iniciar-optica.bat`
6. En **"Finalizar"**, marcar ✅ **"Abrir el cuadro de diálogo Propiedades al hacer clic en Finalizar"**
7. En la ventana de Propiedades:
   - Pestaña **General**:
     - Marcar ✅ **"Ejecutar con los privilegios más altos"**
     - En "Configurar para:" elegir **Windows 10** (o Windows 11)
   - Pestaña **Condiciones**:
     - Desmarcar ❌ "Iniciar la tarea solo si el equipo está conectado a la corriente alterna"
8. Clic en **Aceptar**.

#### Probar que funciona

1. Reiniciar la PC.
2. Esperar ~1 minuto después de que cargue el escritorio.
3. Abrir **http://localhost** en el navegador.

---

## Acceso desde otros dispositivos en la red local

Si querés acceder desde el celular o desde otra computadora en la misma red:

1. Obtener la IP de la PC con Windows:
   ```cmd
   ipconfig
   ```
   Buscar `IPv4 Address` bajo el adaptador de red (ej. `192.168.1.100`)

2. Desde cualquier dispositivo en la misma red WiFi, abrir:
   ```
   http://192.168.1.100
   ```

3. Para que siempre tenga la misma IP, configurar una IP fija en el router o en Windows (opcional pero recomendado).

---

## Actualizar el sistema

Cuando haya cambios en el código (git pull):

```cmd
cd C:\Optica\optica-forever-vision
git pull

cd deploy
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

---

## Comandos útiles de mantenimiento

```cmd
:: Ver logs del backend (errores, etc.)
docker compose -f docker-compose.prod.yml logs backend --tail=50

:: Ver logs del frontend
docker compose -f docker-compose.prod.yml logs frontend --tail=20

:: Reiniciar un servicio específico
docker compose -f docker-compose.prod.yml restart backend

:: Detener todo el sistema
docker compose -f docker-compose.prod.yml down

:: Ver espacio que usa la base de datos
docker volume ls
docker system df
```

---

## Backup de la base de datos

Hacer backup manual:

```cmd
docker compose -f docker-compose.prod.yml exec db pg_dump -U optica optica > backup_%DATE:~-4,4%%DATE:~-7,2%%DATE:~-10,2%.sql
```

Para restaurar:

```cmd
docker compose -f docker-compose.prod.yml exec -T db psql -U optica optica < backup_20240101.sql
```

---

## Solución de problemas frecuentes

### "No se puede conectar a http://localhost"
- Verificar que Docker Desktop esté corriendo (ícono verde en la barra de tareas).
- Ejecutar: `docker compose -f docker-compose.prod.yml ps` y verificar que todos estén `running`.
- Ver logs: `docker compose -f docker-compose.prod.yml logs frontend`.

### "Error de migración de base de datos"
- Verificar que el contenedor `db` esté sano: `docker compose -f docker-compose.prod.yml ps db`.
- Reintentar: `docker compose -f docker-compose.prod.yml exec backend alembic upgrade head`.

### Docker Desktop pide actualizar WSL
- Abrir PowerShell como Administrador y ejecutar: `wsl --update`

### Los datos de Excel no se importan correctamente
- Verificar que el archivo Excel no esté abierto en otra aplicación.
- Revisar que la hoja `bdPacientes` tenga datos desde la fila 5 en adelante.
- Correr con `--quiet` desactivado (sin esa flag) para ver el detalle de cada registro.

---

## Archivos importantes

| Archivo | Descripción |
|---------|-------------|
| `deploy/.env` | Variables de entorno (contraseñas, tokens) — NO subir a Git |
| `deploy/docker-compose.prod.yml` | Configuración de producción |
| `deploy/iniciar-optica.bat` | Script de inicio automático |
| `tools/migrate_excel.py` | Importador de datos desde Excel |
| `backend/alembic/versions/` | Migraciones de base de datos |
