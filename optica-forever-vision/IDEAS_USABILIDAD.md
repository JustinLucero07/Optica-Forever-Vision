# Ideas de Usabilidad — Óptica Forever Vision

## Alta prioridad

### 1. Buscador global (Command Palette)
`Ctrl+K` abre un buscador universal: escribís un nombre de paciente, número de venta u orden, y lleva directo al registro. Evita navegar entre módulos para encontrar algo.

### 2. Alertas en el Dashboard
- Órdenes con estado "listo" (el laboratorio entregó pero nadie avisó al paciente)
- Cuotas de crédito vencidas hoy / esta semana
- Productos con stock por debajo del mínimo
- Turnos de hoy pendientes de confirmación

### 3. Acceso rápido "Nuevo" desde cualquier pantalla
Un botón flotante `+` con un menú: Nueva venta / Nuevo turno / Nuevo cobro / Nuevo paciente. Evita volver al módulo correspondiente cada vez.

### 4. Historial de actividad por paciente
En el perfil del paciente, una línea de tiempo que muestre: consultas, órdenes, ventas y créditos todo junto en orden cronológico. Hoy están en secciones separadas.

---

## Media prioridad

### 5. Confirmación de turno por WhatsApp con respuesta
Cuando el paciente responde "SÍ" o "NO" al recordatorio de WhatsApp, el sistema podría actualizar el estado del turno automáticamente (requiere integración con API de WhatsApp Business).

### 6. Exportar cualquier tabla a Excel
Botón "Exportar" en todas las tablas (Cobros, Créditos, Inventario, etc.) que descargue los datos filtrados como `.xlsx`. Muy útil para contabilidad.

### 7. Modo oscuro
La mayoría del personal trabaja con poca luz en consultorios. Un toggle de dark mode en el sidebar mejoraría la comodidad visual.

### 8. Atajos de teclado en formularios
- `Enter` en el buscador de pacientes → selecciona el primero
- `Esc` cierra cualquier modal
- `Ctrl+S` guarda el formulario activo
- `Ctrl+P` imprime el documento de la vista actual

### 9. Recordatorio automático de cuotas
Una configuración que envíe WhatsApp automáticamente X días antes del vencimiento de cada cuota. Reducción de mora sin trabajo manual.

### 10. Vista de agenda mensual en Turnos
Además de la vista semanal, una vista de mes completo con puntos de color por estado. Útil para ver carga de trabajo a largo plazo.

---

## Baja prioridad / Mejoras de detalle

### 11. Foto del paciente
Subir una foto de perfil. Ayuda a reconocer al paciente al llegar al consultorio, especialmente en ópticas con mucho volumen.

### 12. Campo de "Tipo de armazón preferido" en paciente
Guardar preferencias (material, forma, marca) directamente en el perfil para agilizar recomendaciones futuras.

### 13. Duplicar una venta o presupuesto
"Copiar como nuevo" para ventas recurrentes de los mismos productos. Ahorra re-ingresar ítems idénticos.

### 14. Calculadora de lente integrada
En la orden, un campo de potencia que calcule el precio estimado según los rangos de la casa (ej: hasta -4.00 = precio A, hasta -8.00 = precio B).

### 15. Notas rápidas en turno (memo)
Al finalizar la consulta del día, el optometrista puede dejar una nota breve visible en el siguiente turno del mismo paciente ("revisa tratamiento de glaucoma").

### 16. Impresión de etiqueta de lente
Un formato pequeño (4×6cm) con: nombre del paciente, OD/OI y la prescripción completa, para pegar en el estuche del lente.

### 17. Indicador de saldo en pantalla de ventas
En la lista de ventas, mostrar directamente cuánto queda pendiente de cobro en lugar de solo el total. Evita entrar al detalle para saber si está saldado.

### 18. Filtro de créditos por estado de cuota
En el módulo de Créditos, poder filtrar "solo créditos con cuotas vencidas" para atención prioritaria de cobro.

### 19. Resumen de caja diaria
Un reporte simple de cierre de caja: cobros del día - egresos del día = neto. Imprimible en formato ticket (80mm).

### 20. Notificaciones en tiempo real
Badge en el ícono del módulo cuando hay alertas nuevas (nueva orden lista, cuota vencida). Visible sin entrar al módulo.

---

## Mejoras técnicas con impacto visual

### 21. Búsqueda de pacientes con foto / cédula
Al buscar un paciente en formularios, mostrar miniatura de foto + número de cédula para confirmar que es la persona correcta.

### 22. Columnas ordenables en tablas
Clic en el encabezado de cualquier columna ordena la tabla (ASC/DESC). Útil para ordenar por fecha, monto o nombre.

### 23. Estado visual de órdenes en el Dashboard
Un panel Kanban o lista agrupada por estado: Pendiente / Enviado al Lab / En proceso / Listo / Entregado. Drag-and-drop para cambiar estado.

### 24. Tour de bienvenida para usuarios nuevos
Al crear un usuario por primera vez y hacer login, un tour guiado de 5 pasos que explique los módulos principales. Reduce la curva de aprendizaje.

### 25. Recordatorio de seguimiento post-entrega
X días después de marcar una orden como "entregado", el sistema sugiere enviar un WhatsApp de seguimiento ("¿Cómo le va con sus lentes nuevos?").
