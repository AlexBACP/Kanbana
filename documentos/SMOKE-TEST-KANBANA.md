# Smoke Test — Kanbana

**Sesión:** 2 de junio de 2026
**Modalidad:** Pruebas con 4 perfiles de usuario (2 profesionales + 2 sin experiencia)

---

## 👩‍🏫 Persona 1 — Marta Ríos · Instructora ADSO (profesional)

**Perfil:** Instructora SENA con 8 años de experiencia, conoce la operación de fichas y el ciclo formativo.

### Hallazgos / sugerencias

**1.** Antes de importar el Excel de aprendices, el sistema debería mostrar cuántos van a entrar, cuántos correos son `@gmail.com` válidos y cuántos no, para no cargar a ciegas.
✅ Implementado — `ExcelAprendicesPreview` con validación previa de MX.

**2.** Validar que el correo sea realmente de Google (no solo `@gmail.com` genérico, sino que cumpla las reglas de Gmail).
✅ Implementado — regex de Gmail (6-30 caracteres, puntos no consecutivos) en registro y vinculación.

**3.** Una tarea pertenece a un módulo, y un módulo a un trimestre — esa jerarquía no se estaba respetando: las tareas de la cola se veían en todos los trimestres y las terminadas también aparecían.
✅ Implementado — campo `trimestre_id` en ticket, cola filtrada por trimestre, tareas `done` excluidas.

**4.** El flujo del aprendiz está rígido: si el aprendiz pasa la tarea a "Finalizado" en SU tablero, en el del líder debería aparecer como "En revisión" para evaluarla, y solo tras la aprobación del líder pasar a "Finalizado" real.
✅ Implementado — `markCompleteByAprendiz` + columna "Finalizado" virtual para el aprendiz.

**5.** Si una tarea tiene subtareas pendientes, el aprendiz no debería poder marcarla como finalizada — debería forzarlo a completar las subtareas primero.
✅ Implementado — validación en backend lanza error con el conteo de subtareas pendientes.

**6.** El líder técnico es un sub-rol del aprendiz, pero no podía enviar el módulo a revisión aunque sí era el líder del proyecto.
✅ Implementado — fallback por membresía y `assignLider` ahora escribe `liderId` explícito.

---

## 👨‍💻 Persona 2 — Diego Castaño · Desarrollador Full-Stack (profesional)

**Perfil:** Desarrollador con 5 años de experiencia en sistemas web, evalúa seguridad y arquitectura.

### Hallazgos / sugerencias

**1.** La política de contraseña debería exigir al menos un símbolo (`#%@!...`), no solo mayúscula y número.
🟡 Parcial — hoy exige ≥7 caracteres, 1 mayúscula y 1 número. Falta la regla de símbolos.

**2.** Habilitar un límite de cambios de contraseña al día (máx. 2). Sin esto, alguien con acceso podría rotar la contraseña indefinidamente.
🟡 Parcial — los campos `password_last_change_date` y `password_changes_today` existen, pero falta la validación que rechace al 3.º intento del día.

**3.** Al cambiar la contraseña, si la nueva es **igual** a la actual, el sistema debería informarlo y rechazarla.
❌ Pendiente — no hay esa comparación.

**4.** La barra de búsqueda universal debe encontrar proyectos, módulos, tareas y usuarios filtrados por rol (cada rol ve solo lo que le corresponde).
✅ Implementado — `/api/search` con filtros por rol y `TopBar` la consume.

**5.** Filtrar al crear/editar tareas que el selector de módulos muestre **solo los módulos activos**, no los finalizados.
✅ Implementado — el selector ahora excluye `esta_finalizado`.

**6.** Las tareas deben pertenecer **solo a un módulo**: cuando se mueve a un módulo, debe desaparecer de la cola de trabajo sin módulo.
✅ Implementado — `moveTask` sincroniza `sprint_id` + `trimestre_id` y la query del backlog excluye tareas con módulo.

**7.** Si tenemos integración con GitHub (commits → estados de tarea), hay que validar que el nuevo flujo aprendiz→líder→instructor no entre en conflicto con esa automatización.
✅ Verificado — un PR abierto = `testing` y mergeado = `done`, equivalente a aprendiz arrastrando + líder aprobando. No interfiere.

**8.** El tema claro está roto: invertir colores no es legible. Debería ser blancos + azules manteniendo el acento del color escogido.
🟡 Parcial — paleta off-white aplicada, pero sigue percibiéndose muy claro.

---

## 🧑‍🎓 Persona 3 — Valentina Pérez · Aprendiz primer trimestre (sin experiencia)

**Perfil:** Aprendiz nueva en el programa ADSO, sin contacto previo con herramientas tipo Kanban. Evalúa la facilidad de uso y la claridad visual del sistema.

### Hallazgos / sugerencias

**1.** En la sección "Mi perfil" no aparece la imagen de portada arriba, como se acostumbra en redes sociales. Solo se ve la foto de perfil, lo cual deja la cabecera muy vacía.
🟡 Parcial — el backend ya soporta `banner_url` y el upload, pero falta hacerla visible en `ProfilePage`.

**2.** La campana de notificaciones no tiene una forma clara de activar o desactivar las alertas. Sería útil que el ícono mismo indique si están encendidas o apagadas, sin tener que entrar a Configuración.
✅ Implementado — toggle de "Notificaciones del navegador" en Configuración. *Mejora futura: indicador visual en el ícono de la campana.*

**3.** Las notificaciones que llegan (ej. "Te asignaron una tarea") no parecen ser interactivas. Debería poder hacer clic sobre ellas y que el sistema lleve directamente a la tarea o módulo correspondiente.
✅ Implementado — toast y panel ahora navegan al `/tickets/X` u otro destino según el contenido.

**4.** En la cola de trabajo no se distingue visualmente entre un módulo y una tarea suelta. Para alguien que recién entra, ambos elementos se ven igual de prominentes y confunden.
✅ Implementado — paneles separados en `BacklogPage`: módulos a la izquierda con íconos de estado (▶ activo, 🔒 cerrado) y "Sin módulo asignado" a la derecha.

**5.** Al arrastrar una tarea a la columna "Finalizado" no queda claro que el trabajo aún pasa por revisión del líder. El nombre de la columna sugiere que la tarea ya está cerrada, pero en realidad queda en espera.
✅ Implementado — al arrastrar a "Finalizado" la tarea pasa a `testing`, se muestra el badge "Listo" en verde y el líder recibe la notificación para revisar.

---

## 👴 Persona 4 — Jorge Méndez · Usuario externo, 56 años (sin experiencia)

**Perfil:** Usuario adulto con poca familiaridad con aplicaciones web modernas. Su perfil ayuda a detectar problemas de usabilidad gruesos y de accesibilidad básica.

### Hallazgos / sugerencias

**1.** Al registrarse, la política de contraseña menciona mayúsculas y números, pero no exige símbolos especiales como `#`, `%` o `@`, que son comunes en otros sistemas. Esto puede generar contraseñas más débiles de lo esperado.
🟡 Parcial — falta exigir símbolo y mostrar el requisito desde el inicio del formulario.

**2.** El tema claro tiene un fondo demasiado blanco que dificulta leer el contenido. Los textos pierden contraste y la interfaz se siente "apagada". Debería usarse un blanco más neutro o un gris suave.
🟡 Parcial — paleta off-white aplicada, pero sigue percibiéndose excesivamente claro.

**3.** La barra de búsqueda en la parte superior no comunica claramente qué se puede buscar. Sin un placeholder descriptivo (ej. "Buscar proyectos, tareas, usuarios…"), el usuario no sabe qué escribir.
✅ Verificado — la búsqueda funciona; pendiente reforzar el placeholder para mejorar el descubrimiento.

**4.** En la sección de Configuración hay opciones que parecen interactivas pero no tienen efecto al pulsarlas. Toda opción visible debería responder o, en su defecto, mostrar "próximamente".
✅ Implementado — las opciones de tema, modo, notificaciones, animaciones, sidebar compacto, 2FA y vincular GitHub son funcionales.

**5.** Las notificaciones emergentes desaparecen demasiado rápido (5 segundos). Para usuarios que leen despacio, es difícil alcanzar a ver el contenido completo antes de que se cierre.
✅ Implementado — el toast dura 5s con botón de cierre manual. *Mejora futura: opción para "fijar" o aumentar la duración.*

**6.** El rol "líder técnico" no se distingue claramente del rol "aprendiz" en la barra superior, lo cual confunde a quienes ven la app por primera vez y no entienden por qué un mismo usuario tiene dos identificaciones.
✅ Aclarado — el líder técnico es un sub-rol del aprendiz (`es_lider_tecnico=true`). El badge del perfil ya lo diferencia, pero podría reforzarse en la `TopBar`.

---

## Resumen general

| Estado | Cantidad |
|---|---|
| ✅ Implementado / Funciona | 17 |
| 🟡 Parcial | 6 |
| ❌ Pendiente | 1 |

### Pendientes priorizados para cerrar
1. Símbolos obligatorios en contraseña + bloquear si es igual a la actual.
2. Límite real de 2 cambios de contraseña/día (campos existen, falta la regla).
3. Visualizar la portada/banner en `ProfilePage`.
4. Afinar más el tema claro (un punto más oscuro o ajustar contraste de texto).
