"""Dirige as janelas NATIVAS do Chromium (GTK) com xdotool, sob Xvfb + openbox.
Usado pelos testes E2E que abrem o sistema por file:// como no dia a dia."""
import os, re, shlex, subprocess, time

DISPLAY = os.environ.get('XD_DISPLAY', ':97')
CHROME = os.environ.get('CHROME', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
_procs = []

def sh(cmd, timeout=30):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout, env=dict(os.environ, DISPLAY=DISPLAY))
    return r.stdout.strip()

def iniciar_tela(w=1500, h=950):
    os.environ['DISPLAY'] = DISPLAY
    if sh(f'xdpyinfo -display {DISPLAY} >/dev/null 2>&1 && echo up') == 'up':
        return
    _procs.append(subprocess.Popen(['Xvfb', DISPLAY, '-screen', '0', f'{w}x{h}x24', '-nolisten', 'tcp'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(60):
        time.sleep(0.1)
        if sh(f'xdpyinfo -display {DISPLAY} >/dev/null 2>&1 && echo up') == 'up':
            break
    _procs.append(subprocess.Popen(['openbox'], env=dict(os.environ, DISPLAY=DISPLAY), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    time.sleep(0.6)

def parar_tela():
    for p in _procs:
        try: p.terminate()
        except Exception: pass

def foto(caminho):
    sh(f'import -window root {shlex.quote(caminho)}')

def janelas():
    out = sh("xdotool search --onlyvisible --name '.' 2>/dev/null")
    return [(w, sh(f'xdotool getwindowname {w}')) for w in out.split() if w]

def dialogos():
    return [w for w, n in janelas() if n and not n.endswith('Chromium') and n not in ('chrome', 'openbox')]

def esperar_dialogo(timeout=20):
    t0 = time.time()
    while time.time() - t0 < timeout:
        d = dialogos()
        if d:
            time.sleep(0.4)
            return d[-1]
        time.sleep(0.15)
    raise TimeoutError('nenhuma janela de arquivo apareceu; janelas: %r' % janelas())

def esperar_fechar(w, timeout=10):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if w not in [x for x, _ in janelas()]:
            return True
        time.sleep(0.15)
    return False

def focar(w):
    sh(f'xdotool windowactivate --sync {w} 2>/dev/null || xdotool windowfocus --sync {w}')
    time.sleep(0.2)

def tecla(*ks):
    for k in ks:
        sh(f'xdotool key --clearmodifiers {k}')
        time.sleep(0.15)

def digitar(txt):
    sh(f'xdotool type --delay 6 --clearmodifiers -- {shlex.quote(txt)}')
    time.sleep(0.25)

def _confirmar_caminho(w):
    tecla('Return')
    time.sleep(0.7)
    # o autocompletar do GTK às vezes "come" o primeiro Enter
    if w in [x for x, _ in janelas()]:
        tecla('Return')
        time.sleep(0.7)

def abrir_arquivo(caminho, timeout=20):
    """Janela 'Abrir': digita o caminho completo e confirma."""
    w = esperar_dialogo(timeout); focar(w)
    tecla('ctrl+l'); tecla('ctrl+a'); digitar(caminho)
    _confirmar_caminho(w)
    if not esperar_fechar(w, 8):
        raise RuntimeError('a janela de abrir não fechou')

def salvar_como(caminho, substituir=True, timeout=20):
    """Janela 'Salvar como': nome/caminho completo, Enter e 'Substituir' (Alt+R) se já existir."""
    w = esperar_dialogo(timeout); focar(w)
    tecla('ctrl+a'); digitar(caminho)
    _confirmar_caminho(w)
    if substituir and w in [x for x, _ in janelas()]:
        tecla('alt+r'); time.sleep(0.8)
    if not esperar_fechar(w, 8):
        raise RuntimeError('a janela de salvar não fechou')

def escolher_pasta(caminho, timeout=20):
    """Janela 'Escolher pasta' do GTK: entra na pasta e clica em 'Selecionar' (Alt+S).
    Cuidado com o autocompletar do campo de local (ele completa com a 1ª subpasta):
    Delete apaga o pedaço completado antes do Enter; depois o campo é esvaziado."""
    w = esperar_dialogo(timeout); focar(w)
    tecla('ctrl+l'); tecla('ctrl+a'); digitar(caminho.rstrip('/') + '/')
    time.sleep(0.4); tecla('Delete')
    tecla('Return'); time.sleep(0.7)
    if w not in [x for x, _ in janelas()]:
        return
    focar(w)
    tecla('ctrl+l'); tecla('ctrl+a'); tecla('BackSpace'); time.sleep(0.3)
    tecla('alt+s'); time.sleep(0.8)
    if not esperar_fechar(w, 8):
        raise RuntimeError('a janela de pasta não fechou')

def janela_chromium():
    l = [w for w, n in janelas() if n.endswith('Chromium')]
    return l[-1] if l else None

def permitir(w_chromium=None, metodo='tab'):
    """Confirma a pergunta de permissão do Chrome ("Permitir editar" / "Allow")."""
    w = w_chromium or janela_chromium()
    if w: focar(w)
    time.sleep(0.4)
    if metodo == 'tab':
        tecla('Tab'); tecla('Return')
    time.sleep(0.8)
