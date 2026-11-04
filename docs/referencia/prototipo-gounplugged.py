import tkinter as tk
from tkinter import messagebox

# ==========================================
# FASE 1: LÓGICA DE NEGOCIO (BACKEND)
# ==========================================
class SocioResponsabilidad:
    def __init__(self, nombre):
        self.nombre = nombre
        self.solicitudes_pendientes = []

    def recibir_solicitud(self, usuario):
        self.solicitudes_pendientes.append(usuario)

    def aprobar_desbloqueo(self):
        if self.solicitudes_pendientes:
            usuario = self.solicitudes_pendientes.pop(0)
            return True, f"✅ {self.nombre} ha APROBADO el desbloqueo para {usuario}."
        return False, f"⏳ {self.nombre} no tiene solicitudes pendientes."

class GoUnplugged:
    def __init__(self, usuario, socio):
        self.usuario = usuario
        self.socio = socio
        self.redes_bloqueadas = ["instagram.com", "tiktok.com", "x.com"]
        self.estado_bloqueo = True  # Inicia bloqueado por defecto en este demo

    def intentar_acceso(self, red_social):
        if self.estado_bloqueo and red_social in self.redes_bloqueadas:
            self.socio.recibir_solicitud(self.usuario)
            return False, f"❌ Acceso a {red_social} denegado. Solicitud enviada al socio."
        return True, f"✅ Tráfico permitido hacia {red_social}."

    def sincronizar_autorizacion(self):
        aprobado, msj = self.socio.aprobar_desbloqueo()
        if aprobado:
            self.estado_bloqueo = False
            return True, "🟢 Restricción levantada. Puedes navegar."
        else:
            return False, "🔴 Sin aprobación aún. Mantén el enfoque."

# ==========================================
# FASE 2: INTERFAZ GRÁFICA (FRONTEND)
# ==========================================
class AppGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Go Unplugged - Prototipo")
        self.root.geometry("500x450")
        self.root.configure(bg="#F4F4F8") # Usando colores de tu paleta

        # Instancias del backend
        self.socio = SocioResponsabilidad("Mariana")
        self.app_core = GoUnplugged("Francisco", self.socio)

        self._construir_interfaz()

    def _construir_interfaz(self):
        # Título Principal
        tk.Label(self.root, text="Go Unplugged", font=("Poppins", 20, "bold"), bg="#F4F4F8", fg="#101116").pack(pady=10)

        # Marco del Usuario
        frame_usuario = tk.LabelFrame(self.root, text="Vista del Usuario", bg="#FFFFFF", font=("Inter", 10, "bold"), padx=15, pady=15)
        frame_usuario.pack(fill="x", padx=20, pady=10)

        self.lbl_estado = tk.Label(frame_usuario, text="Estado: 🔴 BLOQUEO ACTIVO", font=("Inter", 12, "bold"), fg="#D32F2F", bg="#FFFFFF")
        self.lbl_estado.pack(pady=5)

        tk.Button(frame_usuario, text="Intentar abrir Instagram", bg="#372FEA", fg="white", font=("Inter", 10, "bold"),
                  command=self.btn_intentar_acceso).pack(fill="x", pady=5)
        
        tk.Button(frame_usuario, text="Sincronizar Permisos", bg="#EFEFF6", fg="#101116", font=("Inter", 10),
                  command=self.btn_sincronizar).pack(fill="x", pady=5)

        # Marco del Socio (Simulación de un segundo teléfono)
        frame_socio = tk.LabelFrame(self.root, text="Simulación: Teléfono del Socio", bg="#ECEDF4", font=("Inter", 10, "bold"), padx=15, pady=15)
        frame_socio.pack(fill="x", padx=20, pady=10)

        self.lbl_notificacion = tk.Label(frame_socio, text="Sin notificaciones.", font=("Inter", 10), bg="#ECEDF4", fg="#4B4E5A")
        self.lbl_notificacion.pack(pady=5)

        tk.Button(frame_socio, text="Aprobar Solicitud", bg="#251CB8", fg="white", font=("Inter", 10, "bold"),
                  command=self.btn_aprobar_socio).pack(fill="x", pady=5)

        # Consola de Registro
        self.consola = tk.Text(self.root, height=6, bg="#101218", fg="#FFFFFF", font=("Courier", 9))
        self.consola.pack(fill="x", padx=20, pady=10)
        self.registrar_log("Sistema iniciado. Bloqueo activo.")

    def registrar_log(self, mensaje):
        self.consola.insert(tk.END, f"> {mensaje}\n")
        self.consola.see(tk.END)

    # --- Controladores de Eventos ---
    def btn_intentar_acceso(self):
        permitido, mensaje = self.app_core.intentar_acceso("instagram.com")
        self.registrar_log(mensaje)
        
        if not permitido:
            self.lbl_notificacion.config(text="🔔 ¡Francisco quiere desbloquear las redes!", fg="#D32F2F")
            messagebox.showwarning("Acceso Bloqueado", "Aplicación bloqueada. Se ha notificado a tu socio.")

    def btn_aprobar_socio(self):
        # Esta acción ocurre conceptualmente en el teléfono del socio
        if self.socio.solicitudes_pendientes:
            self.registrar_log("Socio: Solicitud aprobada localmente. Esperando que el usuario sincronice.")
            self.lbl_notificacion.config(text="Aprobación registrada en el servidor.", fg="#2E7D32")
        else:
            messagebox.showinfo("Socio", "No hay solicitudes pendientes.")

    def btn_sincronizar(self):
        # El teléfono del usuario consulta la base de datos
        aprobado, mensaje = self.app_core.sincronizar_autorizacion()
        self.registrar_log(mensaje)

        if aprobado:
            self.lbl_estado.config(text="Estado: 🟢 DESBLOQUEADO", fg="#2E7D32")
            self.lbl_notificacion.config(text="Sin notificaciones.", fg="#4B4E5A")
            messagebox.showinfo("Éxito", "Restricción levantada temporalmente.")

if __name__ == "__main__":
    root = tk.Tk()
    app = AppGUI(root)
    root.mainloop()