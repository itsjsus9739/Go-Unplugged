<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Go Unplugged - Prototipo</title>
  <style>
    * { box-sizing: border-box; font-family: 'Inter', sans-serif; }
    body {
      background-color: #F4F4F8;
      display: flex;
      justify-content: center;
      padding: 30px 15px;
      margin: 0;
    }
    .contenedor {
      width: 100%;
      max-width: 500px;
    }
    h1 {
      font-family: 'Poppins', sans-serif;
      font-size: 24px;
      font-weight: bold;
      color: #101116;
      text-align: center;
      margin-top: 0;
    }
    .panel {
      border: 1px solid #d5d7e0;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 15px;
    }
    .panel-usuario { background-color: #FFFFFF; }
    .panel-socio { background-color: #ECEDF4; }
    .panel-titulo {
      font-size: 13px;
      font-weight: bold;
      margin-bottom: 10px;
      color: #101116;
    }
    .estado {
      text-align: center;
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 12px;
    }
    .estado-bloqueado { color: #D32F2F; }
    .estado-desbloqueado { color: #2E7D32; }
    .notificacion {
      text-align: center;
      font-size: 13px;
      color: #4B4E5A;
      margin-bottom: 12px;
    }
    button {
      width: 100%;
      padding: 10px;
      font-size: 13px;
      font-weight: bold;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      margin-bottom: 8px;
    }
    .btn-principal { background-color: #372FEA; color: #FFFFFF; }
    .btn-secundario { background-color: #EFEFF6; color: #101116; }
    .btn-socio { background-color: #251CB8; color: #FFFFFF; }
    .consola {
      background-color: #101218;
      color: #FFFFFF;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      height: 120px;
      overflow-y: auto;
      border-radius: 6px;
      padding: 10px;
    }
  </style>
</head>
<body>

  <div class="contenedor">
    <h1>Go Unplugged</h1>

    <!-- Vista del Usuario -->
    <div class="panel panel-usuario">
      <div class="panel-titulo">Vista del Usuario</div>
      <div id="lblEstado" class="estado estado-bloqueado">Estado: 🔴 BLOQUEO ACTIVO</div>
      <button class="btn-principal" onclick="intentarAcceso()">Intentar abrir Instagram</button>
      <button class="btn-secundario" onclick="sincronizar()">Sincronizar Permisos</button>
    </div>

    <!-- Simulación del Socio -->
    <div class="panel panel-socio">
      <div class="panel-titulo">Simulación: Teléfono del Socio</div>
      <div id="lblNotif" class="notificacion">Sin notificaciones.</div>
      <button class="btn-socio" onclick="aprobarSocio()">Aprobar Solicitud</button>
    </div>

    <!-- Consola de Registro -->
    <div id="consola" class="consola">
      > Sistema iniciado. Bloqueo activo.<br>
    </div>
  </div>

  <script>
    // Variables de estado
    let estadoBloqueo = true;
    let solicitudesPendientes = [];
    let aprobacionPendienteSincronizar = false;
    const usuario = "Francisco";
    const socioNombre = "Mariana";

    function log(msg) {
      const consola = document.getElementById("consola");
      consola.innerHTML += `> ${msg}<br>`;
      consola.scrollTop = consola.scrollHeight;
    }

    function intentarAcceso() {
      if (estadoBloqueo) {
        solicitudesPendientes.push(usuario);
        log("❌ Acceso a instagram.com denegado. Solicitud enviada al socio.");
        const lbl = document.getElementById("lblNotif");
        lbl.innerText = `🔔 ¡${usuario} quiere desbloquear las redes!`;
        lbl.style.color = "#D32F2F";
        alert("Aplicación bloqueada. Se ha notificado a tu socio.");
      } else {
        log("✅ Tráfico permitido hacia instagram.com.");
      }
    }

    function aprobarSocio() {
      if (solicitudesPendientes.length > 0) {
        solicitudesPendientes.shift();
        aprobacionPendienteSincronizar = true;
        log(`Socio: Solicitud aprobada localmente. Esperando que el usuario sincronice.`);
        const lbl = document.getElementById("lblNotif");
        lbl.innerText = "Aprobación registrada en el servidor.";
        lbl.style.color = "#2E7D32";
      } else {
        alert("No hay solicitudes pendientes.");
      }
    }

    function sincronizar() {
      if (aprobacionPendienteSincronizar) {
        aprobacionPendienteSincronizar = false;
        estadoBloqueo = false;
        log("🟢 Restricción levantada. Puedes navegar.");
        
        const lblEstado = document.getElementById("lblEstado");
        lblEstado.className = "estado estado-desbloqueado";
        lblEstado.innerText = "Estado: 🟢 DESBLOQUEADO";

        const lblNotif = document.getElementById("lblNotif");
        lblNotif.innerText = "Sin notificaciones.";
        lblNotif.style.color = "#4B4E5A";

        alert("Restricción levantada temporalmente.");
      } else {
        log("🔴 Sin aprobación aún. Mantén el enfoque.");
      }
    }
  </script>
</body>
</html>
