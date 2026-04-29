# Guía de pruebas funcionales — Operador

**Manobi Sentinel · Parques Nacionales Naturales de Colombia**

---

Propósito: verificar, paso a paso, que cada módulo del sistema funciona como se espera. Está pensada para ser impresa y marcada con lápiz: cada prueba tiene casillas de **PASA / FALLA** y un campo de observaciones.

Tiempo estimado: **45–60 minutos** para la batería completa.

| Ítem | Valor |
|---|---|
| Probado por | ________________________________________ |
| Cargo | ________________________________________ |
| Fecha | ____ / ____ / ________ |
| Hora inicio | ____ : ____ |
| Hora fin | ____ : ____ |
| Entorno | ☐ Producción &nbsp;&nbsp; ☐ Pruebas |
| URL | ________________________________________ |
| Navegador | ________________________________________ |

---

## 0. Datos de acceso para la prueba

Registre aquí las credenciales que le entregó el administrador (**no las comparta por chat ni email**):

| Campo | Valor |
|---|---|
| URL de la app | ________________________________________ |
| Email de usuario | ________________________________________ |
| Contraseña | ________________________________________ |
| Rol | ☐ Admin &nbsp; ☐ Operador &nbsp; ☐ Consulta |
| Email donde llega el código OTP | ________________________________________ |

---

## 1. Acceso y autenticación

### TC-01 · Abrir la aplicación

**Pasos:**
1. Abra el navegador (Chrome o Edge actualizado).
2. Escriba la URL entregada en la barra de direcciones. Pulse Enter.

**Resultado esperado:**
- La página de login carga en menos de 3 segundos.
- Ve el logo de Manobi Sentinel, el nombre "Manobi Sentinel", y debajo "Sistema de Alerta Temprana · PNN Colombia".
- Aparece el formulario con los campos "Email institucional" y "Contraseña".

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

### TC-02 · Login con credenciales correctas (paso 1)

**Pasos:**
1. Escriba el email institucional en el campo "Email institucional".
2. Escriba la contraseña en el campo "Contraseña".
3. Pulse el botón **Continuar**.

**Resultado esperado:**
- El botón muestra brevemente "Verificando…".
- Se cambia a la pantalla "Verificación en dos pasos" que dice: *Enviamos un código a u\*\*\*@dominio.com. Expira en 5 min.*
- Aparece un input grande centrado para 6 dígitos.

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

### TC-03 · Recepción del código OTP por email

**Pasos:**
1. Abra su bandeja de entrada del email institucional.
2. Espere máximo 30 segundos.
3. Busque un correo con asunto "[Manobi Sentinel] Código XXX XXX" de `redes.seguridad@parquesnacionales.gov.co`.
4. Si no lo ve, revise la carpeta de SPAM / Correo no deseado.

**Resultado esperado:**
- El correo llega en menos de 30 segundos.
- En el cuerpo aparece un código de 6 dígitos destacado en grande (ej. "123 456").
- Menciona que expira en 5 minutos.

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

### TC-04 · Verificación del código (paso 2)

**Pasos:**
1. Vuelva al navegador donde tiene el formulario de código.
2. Escriba los 6 dígitos del email.
3. Pulse **Ingresar**.

**Resultado esperado:**
- En menos de 2 segundos la pantalla cambia al Dashboard.
- En la barra superior aparece su nombre (o la primera letra), el rol (ADMIN / OPERADOR / CONSULTA) y un ícono de cerrar sesión.

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

### TC-05 · Código OTP incorrecto

**Pasos:**
1. Cierre sesión (ícono de flecha saliendo en la esquina superior derecha).
2. Vuelva a hacer login con las credenciales correctas hasta llegar al paso 2.
3. Escriba un código falso: `000000`.
4. Pulse **Ingresar**.

**Resultado esperado:**
- Aparece un mensaje rojo: *Código incorrecto. Te quedan N intento(s).*
- No avanza al dashboard.
- El contador baja cada intento fallido.

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

### TC-06 · Reenvío del código

**Pasos:**
1. En la pantalla del paso 2, intente presionar **Reenviar código** inmediatamente.
2. Debe aparecer deshabilitado con un contador (`Reenviar en XXs`).
3. Espere a que el contador llegue a 0.
4. Pulse **Reenviar código**.

**Resultado esperado:**
- Mensaje azul: *Nuevo código enviado. Revisa tu correo.*
- Llega un correo NUEVO con un código distinto al anterior.
- El código viejo ya no funciona; el nuevo sí.

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

### TC-07 · Cerrar sesión

**Pasos:**
1. En el Dashboard, haga clic en el ícono de flecha saliendo (esquina superior derecha).

**Resultado esperado:**
- Redirige a la pantalla de login.
- Si presiona el botón de atrás del navegador, no puede volver al Dashboard (tiene que loguear de nuevo).

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

## 2. Dashboard y mapa

_Ingrese de nuevo al sistema antes de continuar._

### TC-08 · Mapa base carga correctamente

**Pasos:**
1. Observe el mapa central del Dashboard.

**Resultado esperado:**
- Se ven los polígonos de los parques de Colombia con colores (rojo / amarillo / verde según nivel de riesgo).
- Se ve el mapa base de fondo (calles, ríos, relieve) — no aparece en negro.
- La leyenda "NIVEL DE RIESGO" aparece abajo a la derecha.

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

### TC-09 · Control de capas

**Pasos:**
1. En la esquina superior derecha del mapa, haga clic en el panel "CAPAS".
2. Desactive "Parques". Observe el mapa.
3. Vuelva a activar "Parques".
4. Active "Heatmap IA". Seleccione "Incendio" en el selector que aparece.
5. Desactive "Heatmap IA".

**Resultado esperado:**
- Al desactivar Parques desaparecen los polígonos; al activar vuelven.
- Al activar Heatmap IA aparece una capa de color difuso sobre las zonas con riesgo predicho.
- Cada toggle es inmediato (menos de 1 segundo).

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

### TC-10 · Click en un parque abre el panel de detalle

**Pasos:**
1. Haga clic sobre el polígono de un parque en el mapa.

**Resultado esperado:**
- Arriba a la izquierda del mapa aparece un panel con nombre del parque, región y nivel de riesgo (chip de color).
- El botón "× Vista general" cierra el panel y centra el mapa.

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

### TC-11 · Alertas activas a la izquierda

**Pasos:**
1. Mire el panel izquierdo "Alertas activas".

**Resultado esperado:**
- Muestra un número grande en rojo con la cantidad total de alertas activas.
- Lista cada alerta con chip de nivel (ROJO / AMARILLO / VERDE), tipo, parque, y "hace N min".
- Las alertas rojas tienen una barra lateral roja visible.

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

### TC-12 · Click en alerta centra el mapa en el parque

**Pasos:**
1. Haga clic sobre una alerta de la lista.

**Resultado esperado:**
- El mapa hace zoom al parque asociado.
- El panel de detalle aparece con el nombre del parque.
- En móvil, el cambio debe ir acompañado del switch al tab "Mapa".

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

### TC-13 · Cerrar una alerta (solo admin/operador)

**Pasos:**
1. En una tarjeta de alerta activa, pase el mouse sobre la esquina superior derecha: aparece una **×** pequeña.
2. Pulse la × y confirme el cuadro de diálogo.

**Resultado esperado:**
- La alerta desaparece de la lista.
- El contador de alertas activas baja en 1.

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

### TC-14 · Métricas en tiempo real (panel derecho)

**Pasos:**
1. Mire el panel derecho "Métricas en tiempo real".

**Resultado esperado:**
- Tres tarjetas de contadores: ROJO, AMARILLO, VERDE.
- Sección "Top 3 parques con más alertas" con nombre y número.
- Sección "IA · Predicciones" con:
  - Subtítulo explicando los umbrales (bajo &lt;40 %, medio 40-70 %, alto &gt;70 %).
  - 5 filas con ícono 🔥 o 💧, nombre del parque, barra de progreso, porcentaje.

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

### TC-15 · Eventos climáticos (timeline inferior)

**Pasos:**
1. En el borde inferior del dashboard aparece una barra llamada "24H" con un triángulo **▲ expandir**.
2. Haga clic en ella.

**Resultado esperado:**
- Se despliega un panel con:
  - Contadores por tipo (incendio, lluvia, temperatura, viento, humedad, presión).
  - Un filtro por tipo.
  - Lista de los eventos más recientes.
- Al volver a hacer clic se colapsa.

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

## 3. Histórico

### TC-16 · Navegar a Histórico

**Pasos:**
1. En la barra superior, pulse **Histórico**.

**Resultado esperado:**
- Se abre la página `/historico` en menos de 1 segundo.
- Arriba aparecen filtros: Parque, Nivel, Desde, Hasta, botón CSV.
- Hay un gráfico de barras "ALERTAS POR DÍA".
- Abajo una tabla paginada con histórico de alertas.

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

### TC-17 · Filtro por nivel

**Pasos:**
1. En el selector "NIVEL" escoja **Rojo**.
2. Observe la tabla.

**Resultado esperado:**
- La tabla sólo muestra alertas nivel Rojo.
- El gráfico superior también se recalcula.

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

### TC-18 · Exportar CSV

**Pasos:**
1. Con cualquier filtro aplicado, pulse el botón **CSV**.

**Resultado esperado:**
- El navegador descarga un archivo `alertas_historico_YYYY-MM-DD.csv`.
- Al abrirlo en Excel o similar, tiene columnas: tipo, nivel, parque, estado, fecha_inicio, fecha_fin.

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

## 4. Reglas (motor de alertas)

### TC-19 · Listar reglas activas

**Pasos:**
1. Pulse **Reglas** en la barra superior.

**Resultado esperado:**
- Se listan las reglas configuradas (habrá ~10 por defecto).
- Cada una muestra nombre, nivel resultante, estado activo/inactivo.

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

### TC-20 · Ver el detalle de una regla

**Pasos:**
1. Haga clic en una regla de la lista.

**Resultado esperado:**
- En el panel derecho aparece la condición JSON, nivel, acción sugerida.
- Se puede editar los campos.

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

## 5. Suscripciones de notificación

### TC-21 · Navegar a Suscripciones

**Pasos:**
1. Pulse **Suscripciones** en la barra superior.

**Resultado esperado:**
- Panel izquierdo "NUEVA SUSCRIPCIÓN" con formulario.
- Panel derecho "MIS SUSCRIPCIONES" con las existentes.

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

### TC-22 · Crear suscripción email

**Pasos:**
1. Canal: **Email**.
2. Destino: un email suyo de prueba.
3. Parque: **Todos**.
4. Niveles: seleccione **Rojo** y **Amarillo**.
5. Pulse **CREAR SUSCRIPCIÓN**.

**Resultado esperado:**
- La suscripción aparece en la lista de la derecha con un punto verde (activa).
- Los chips muestran los niveles seleccionados.

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

### TC-23 · Pausar y reactivar suscripción

**Pasos:**
1. Pulse el botón **Pausar** en su suscripción recién creada.
2. Observe el punto verde se vuelve gris.
3. Pulse **Reactivar**.

**Resultado esperado:**
- El estado cambia en menos de 1 segundo.
- Mientras está pausada, no se le envían correos aunque haya alertas.

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

### TC-24 · Intento de webhook a URL interna (rechazado por SSRF)

_Solo si tiene rol Admin._

**Pasos:**
1. Canal: **Webhook**.
2. Destino: `http://localhost:8080/hook` o `http://postgres:5432`.
3. Pulse **CREAR SUSCRIPCIÓN**.

**Resultado esperado:**
- Aparece un error claro del tipo: *Host X no permitido* o *IP privada no permitida para webhooks*.
- No se crea la suscripción.

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

## 6. Reportes

### TC-25 · Generar reporte PDF

**Pasos:**
1. Pulse **Reportes** en la barra superior.
2. Tipo: "Resumen de alertas".
3. Formato: **PDF**.
4. Niveles: Rojo + Amarillo.
5. Desde / Hasta: los últimos 7 días.
6. Pulse **GENERAR**.

**Resultado esperado:**
- Mensaje azul: *Reporte generado correctamente*.
- Aparece en la lista de la derecha con formato PDF.

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

### TC-26 · Descargar reporte

**Pasos:**
1. En la lista, pulse **Descargar** en el reporte recién generado.

**Resultado esperado:**
- Se descarga un PDF con el logo de PNN, tabla de alertas, fechas.
- El archivo abre correctamente en el visor PDF.

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

### TC-27 · Eliminar reporte

**Pasos:**
1. En la fila del reporte de prueba, pulse **Eliminar**.
2. Confirme el diálogo.

**Resultado esperado:**
- El reporte desaparece de la lista.
- El total baja en 1.

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

## 7. Usuarios (solo Admin)

### TC-28 · Crear usuario operador

_Omitir si no es Admin._

**Pasos:**
1. Pulse **Usuarios** en la barra superior.
2. Complete nombre, email, contraseña temporal, rol **Operador**.
3. Pulse **CREAR**.

**Resultado esperado:**
- El usuario aparece en la lista con rol operador y estado activo.

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

### TC-29 · Desactivar usuario

**Pasos:**
1. Sobre el usuario de prueba recién creado, pulse **Desactivar**.
2. Intente iniciar sesión con ese usuario en una ventana de incógnito.

**Resultado esperado:**
- El usuario no puede loguear; recibe *Credenciales inválidas*.

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

## 8. Respaldos (solo Admin)

### TC-30 · Generar respaldo cifrado

**Pasos:**
1. Pulse **Respaldos** en la barra superior.
2. Marque el checkbox "Cifrar con contraseña".
3. Escriba una contraseña de prueba de al menos 8 caracteres. Anótela.
4. Pulse **GENERAR RESPALDO**.

**Resultado esperado:**
- Aparece barra de progreso y luego mensaje *Backup generado (XX MB) [cifrado]*.
- En la lista de la derecha aparece un archivo `backup-manobi-completo-…-enc.pnnc` con chip CIFRADO.

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

### TC-31 · Verificar respaldo (con contraseña correcta)

**Pasos:**
1. En el backup creado, pulse **Verificar**.
2. Escriba la contraseña anotada.
3. Pulse **Ejecutar**.

**Resultado esperado:**
- Aparece JSON con manifest: versión, tipo, fecha, contenido, etc.
- Mensaje sin errores.

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

### TC-32 · Verificar respaldo (con contraseña INCORRECTA)

**Pasos:**
1. En el mismo backup, pulse **Verificar** de nuevo.
2. Escriba una contraseña distinta.
3. Pulse **Ejecutar**.

**Resultado esperado:**
- Mensaje rojo: *Contraseña incorrecta o archivo corrupto* o similar.
- No expone el manifest.

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

### TC-33 · Restaurar en DB temporal (safe)

**Pasos:**
1. Pulse **Restaurar (test)**.
2. Escriba la contraseña correcta.
3. Pulse **Ejecutar**.

**Resultado esperado:**
- Después de ~30 segundos devuelve JSON con `counts`: número de parques, alertas, usuarios, etc.
- Los valores son coherentes (ej. parques: 73).
- La producción NO se ve afectada.

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

## 9. Responsive (móvil)

### TC-34 · Abrir app en teléfono

**Pasos:**
1. Abra la URL en Chrome/Safari del celular.

**Resultado esperado:**
- La pantalla de login se ve bien sin scroll horizontal.
- Los campos son grandes y fáciles de tocar.

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

### TC-35 · Tabs del dashboard en móvil

**Pasos:**
1. Logueado en móvil, debajo del TopBar aparecen 3 tabs: **Mapa**, **Alertas**, **Métricas**.
2. Pruebe cada tab.

**Resultado esperado:**
- Cada tab muestra su contenido y oculta los demás.
- No hay cortes ni desbordes.

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

## 10. Rendimiento

### TC-36 · Tiempo de carga del Dashboard

**Pasos:**
1. En un equipo ya logueado, presione **Ctrl+Shift+R** (recarga total).
2. Con cronómetro, cuente desde que desaparece la pantalla blanca hasta que el mapa y las alertas se ven completas.

**Resultado esperado:**
- Menos de **5 segundos** en primera carga.
- Menos de **2 segundos** en recargas siguientes (caché).
- El navegador no se congela.

Tiempo medido: ____ segundos &nbsp;&nbsp; ☐ PASA &nbsp;&nbsp; ☐ FALLA

Observaciones: ________________________________________

---

### TC-37 · Cambio de capa del mapa sin traba

**Pasos:**
1. Active y desactive "Puntos de Calor" 5 veces seguidas.
2. Active y desactive "Heatmap IA" 5 veces seguidas.

**Resultado esperado:**
- Cada toggle responde inmediato (&lt; 500 ms).
- No aparecen errores ni pantalla en blanco.

☐ PASA &nbsp;&nbsp; ☐ FALLA &nbsp;&nbsp; Observaciones: ________________________________________

---

## 11. Resumen de la prueba

| # | Área | Total | Pasa | Falla |
|---|---|---|---|---|
| 1 | Acceso y autenticación | 7 | ___ | ___ |
| 2 | Dashboard y mapa | 8 | ___ | ___ |
| 3 | Histórico | 3 | ___ | ___ |
| 4 | Reglas | 2 | ___ | ___ |
| 5 | Suscripciones | 4 | ___ | ___ |
| 6 | Reportes | 3 | ___ | ___ |
| 7 | Usuarios (admin) | 2 | ___ | ___ |
| 8 | Respaldos (admin) | 4 | ___ | ___ |
| 9 | Responsive | 2 | ___ | ___ |
| 10 | Rendimiento | 2 | ___ | ___ |
| **Total** | | **37** | | |

### Conclusión

☐ **Aprobado** — todos los casos críticos pasan; las fallas son menores y documentadas.

☐ **Aprobado con observaciones** — quedan tareas pendientes pero la funcionalidad central opera.

☐ **Rechazado** — hay fallas que bloquean el uso operativo.

### Incidencias más relevantes encontradas

1. ________________________________________________________________

2. ________________________________________________________________

3. ________________________________________________________________

### Recomendaciones

________________________________________________________________
________________________________________________________________
________________________________________________________________

### Firmas

| | Responsable de la prueba | Supervisor técnico |
|---|---|---|
| Nombre | | |
| Firma | | |
| Fecha | | |

---

**Canales de soporte**

Si alguna prueba falla de forma bloqueante:

- Email técnico: `fbolivarb@gmail.com`
- Repositorio con historial completo: <https://github.com/fbolivar/manobi-sentinel>
- Log de errores del servidor (solo admin SSH): `docker compose logs api --tail 200`
