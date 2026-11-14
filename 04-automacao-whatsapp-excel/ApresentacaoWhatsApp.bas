Option Explicit

' ============================================================
' APRESENTACAO PARA O CLIENTE (PDV) - WHATSAPP WEB
' (somente texto, sem imagem)
'
' Versao publica de demonstracao: sem dados reais e sem marca.
' Ajuste NOME_PLANILHA, as colunas e a mensagem para o seu caso.
'
' Para cada PDV com "Status Cliente" vazio (coluna L):
'   1. Monta a mensagem de apresentacao com o PDV e a Razao Fantasia
'   2. Abre a conversa pelo link web.whatsapp.com/send?phone=...
'      (funciona mesmo com numero que NAO esta salvo nos contatos,
'       e nao corre o risco de abrir a conversa de outra pessoa)
'   3. Confere que a mensagem apareceu na caixa de texto e envia
'   4. Confere que a caixa ficou vazia (envio confirmado)
'   5. Registra "ENVIADO + data/hora" na coluna L
'
' Um PDV com varias linhas (varios titulos) recebe UMA mensagem so.
'
' Antes de rodar:
'   - Deixe o WhatsApp Web ABERTO e carregado, como aba ativa
'   - Mantenha so UMA aba do WhatsApp Web aberta
'   - Nao use mouse/teclado durante o envio
'   - Para interromper: clique em qualquer janela fora do navegador
'     (por exemplo, no Excel). A macro para com seguranca.
' ============================================================

' ============================================================
' CONFIGURACAO DA PLANILHA
' ============================================================
Private Const NOME_PLANILHA As String = "BASE CLIENTES"

Private Const LINHA_CABECALHO As Long = 3
Private Const PRIMEIRA_LINHA As Long = 4

' ============================================================
' COLUNAS DA PLANILHA
' ============================================================
Private Const COL_NOME_FANTASIA As Long = 4    ' D
Private Const COL_PDV As Long = 5              ' E
Private Const COL_TELEFONE_PDV As Long = 9     ' I
Private Const COL_STATUS_CLIENTE As Long = 12  ' L (controle do envio)

Private Const DDI As String = "55"

' ============================================================
' MENSAGEM
' ============================================================
Private Const NOME_REMETENTE As String = "Seu nome"
Private Const EMPRESA As String = "Sua Empresa"
Private Const UNIDADE As String = "Unidade Exemplo"

' ============================================================
' OPCOES
' ============================================================
' Manda TODAS as mensagens para esse numero (teste). Vazio = normal
Private Const TELEFONE_TESTE As String = ""

' Maximo de PDVs por execucao (0 = sem limite).
' Muitas mensagens seguidas para numeros novos podem fazer o
' WhatsApp bloquear o numero por spam. Os demais ficam para depois.
Private Const LIMITE_POR_EXECUCAO As Long = 60

' Salvar a planilha a cada X envios (salvar e lento em arquivos grandes)
Private Const SALVAR_A_CADA As Long = 20

' ============================================================
' TEMPOS (segundos) - MODO RAPIDO
' A macro nao espera tempos fixos: ela fica conferindo a tela
' e segue assim que a conversa abre / a mensagem sai.
' ============================================================
Private Const SEG_CARREGAR_WHATSAPP As Double = 20    ' so se precisar abrir o WhatsApp Web
Private Const SEG_TIMEOUT_CONVERSA As Double = 30     ' maximo para a conversa abrir
Private Const SEG_ENTRE_VERIFICACOES As Double = 0.4  ' de quanto em quanto tempo confere a tela
Private Const SEG_TIMEOUT_ENVIO As Double = 6         ' maximo para confirmar o envio
Private Const SEG_APOS_ENVIAR As Double = 1           ' folga para a mensagem sair antes de trocar de conversa
Private Const SEG_ESPERA_TECLA As Double = 0.06

' Pausa aleatoria entre um PDV e outro.
' Menor = mais rapido, porem maior risco de bloqueio por spam.
Private Const SEG_INTERVALO_MIN As Double = 3
Private Const SEG_INTERVALO_MAX As Double = 6

' ============================================================
' CONSTANTES INTERNAS
' ============================================================
Private Const SENTINELA As String = "#SENTINELA_PDV_8K2#"

Private Const RES_ENVIADO As Long = 1
Private Const RES_FALHOU As Long = 2
Private Const RES_ABORTAR As Long = 3
Private Const RES_INCERTO As Long = 4

Private Const SW_SHOW As Long = 5
Private Const SW_MINIMIZE As Long = 6
Private Const SW_RESTORE As Long = 9
Private Const GA_ROOTOWNER As Long = 3
Private Const ASFW_ANY As Long = -1

Private Const KEYEVENTF_EXTENDEDKEY As Long = &H1&
Private Const KEYEVENTF_KEYUP As Long = &H2&
Private Const VK_BACK As Long = &H8&
Private Const VK_RETURN As Long = &HD&
Private Const VK_SHIFT As Long = &H10&
Private Const VK_CONTROL As Long = &H11&
Private Const VK_MENU As Long = &H12&
Private Const VK_ESCAPE As Long = &H1B&
Private Const VK_END As Long = &H23&
Private Const VK_A As Long = &H41&
Private Const VK_C As Long = &H43&
Private Const VK_L As Long = &H4C&
Private Const VK_V As Long = &H56&

Private Const CF_UNICODETEXT As Long = 13
Private Const GHND As Long = &H42&

' ============================================================
' APIS DO WINDOWS
' ============================================================
Private Declare PtrSafe Function OpenClipboard Lib "user32" (ByVal hwnd As LongPtr) As Long
Private Declare PtrSafe Function EmptyClipboard Lib "user32" () As Long
Private Declare PtrSafe Function CloseClipboard Lib "user32" () As Long
Private Declare PtrSafe Function SetClipboardData Lib "user32" (ByVal wFormat As Long, ByVal hMem As LongPtr) As LongPtr
Private Declare PtrSafe Function GetClipboardData Lib "user32" (ByVal wFormat As Long) As LongPtr
Private Declare PtrSafe Function IsClipboardFormatAvailable Lib "user32" (ByVal wFormat As Long) As Long
Private Declare PtrSafe Function GlobalAlloc Lib "kernel32" (ByVal wFlags As Long, ByVal dwBytes As LongPtr) As LongPtr
Private Declare PtrSafe Function GlobalLock Lib "kernel32" (ByVal hMem As LongPtr) As LongPtr
Private Declare PtrSafe Function GlobalUnlock Lib "kernel32" (ByVal hMem As LongPtr) As Long
Private Declare PtrSafe Function GlobalFree Lib "kernel32" (ByVal hMem As LongPtr) As LongPtr
Private Declare PtrSafe Function lstrlenW Lib "kernel32" (ByVal lpString As LongPtr) As Long
Private Declare PtrSafe Sub CopyMemory Lib "kernel32" Alias "RtlMoveMemory" (ByVal Destination As LongPtr, ByVal Source As LongPtr, ByVal Length As LongPtr)
Private Declare PtrSafe Sub Sleep Lib "kernel32" (ByVal dwMilliseconds As Long)
Private Declare PtrSafe Function GetDesktopWindow Lib "user32" () As LongPtr
Private Declare PtrSafe Function GetWindow Lib "user32" (ByVal hwnd As LongPtr, ByVal wCmd As Long) As LongPtr
Private Declare PtrSafe Function GetWindowTextLengthW Lib "user32" (ByVal hwnd As LongPtr) As Long
Private Declare PtrSafe Function GetWindowTextW Lib "user32" (ByVal hwnd As LongPtr, ByVal lpString As LongPtr, ByVal cch As Long) As Long
Private Declare PtrSafe Function IsWindowVisible Lib "user32" (ByVal hwnd As LongPtr) As Long
Private Declare PtrSafe Function IsWindow Lib "user32" (ByVal hwnd As LongPtr) As Long
Private Declare PtrSafe Function IsIconic Lib "user32" (ByVal hwnd As LongPtr) As Long
Private Declare PtrSafe Function ShowWindow Lib "user32" (ByVal hwnd As LongPtr, ByVal nCmdShow As Long) As Long
Private Declare PtrSafe Function SetForegroundWindow Lib "user32" (ByVal hwnd As LongPtr) As Long
Private Declare PtrSafe Function BringWindowToTop Lib "user32" (ByVal hwnd As LongPtr) As Long
Private Declare PtrSafe Function SetActiveWindow Lib "user32" (ByVal hwnd As LongPtr) As LongPtr
Private Declare PtrSafe Function GetForegroundWindow Lib "user32" () As LongPtr
Private Declare PtrSafe Function GetAncestor Lib "user32" (ByVal hwnd As LongPtr, ByVal gaFlags As Long) As LongPtr
Private Declare PtrSafe Function GetWindowThreadProcessId Lib "user32" (ByVal hwnd As LongPtr, ByRef lpdwProcessId As Long) As Long
Private Declare PtrSafe Function AttachThreadInput Lib "user32" (ByVal idAttach As Long, ByVal idAttachTo As Long, ByVal fAttach As Long) As Long
Private Declare PtrSafe Function AllowSetForegroundWindow Lib "user32" (ByVal dwProcessId As Long) As Long
Private Declare PtrSafe Function GetCurrentThreadId Lib "kernel32" () As Long
Private Declare PtrSafe Sub keybd_event Lib "user32" (ByVal bVk As Byte, ByVal bScan As Byte, ByVal dwFlags As Long, ByVal dwExtraInfo As LongPtr)
Private Declare PtrSafe Function MapVirtualKeyW Lib "user32" (ByVal uCode As Long, ByVal uMapType As Long) As Long

' Janela do navegador com o WhatsApp Web
Private mJanelaWpp As LongPtr


' ============================================================
' MACRO PRINCIPAL
' ============================================================
Public Sub EnviarApresentacaoPDV()

    Dim ws As Worksheet
    Dim ultimaLinha As Long
    Dim ultimaCol As Long
    Dim dados As Variant
    Dim i As Long
    Dim linha As Long

    Dim dLinhas As Object        ' PDV -> "4;9;12" (linhas da planilha)
    Dim dFantasia As Object      ' PDV -> Razao Fantasia
    Dim dTelefone As Object      ' PDV -> telefone
    Dim fila As Collection       ' PDVs a enviar
    Dim chave As Variant

    Dim pdv As String
    Dim pdvAtual As String
    Dim statusAtual As String
    Dim telefone As String
    Dim mensagem As String
    Dim motivo As String
    Dim res As Long
    Dim n As Long
    Dim total As Long

    Dim enviados As Long
    Dim falhas As Long
    Dim semTelefone As Long
    Dim restantes As Long
    Dim listaFalhas As String
    Dim interrompido As Boolean
    Dim motivoParada As String
    Dim texto As String

    Dim numeroErro As Long
    Dim descricaoErro As String

    On Error GoTo TrataErro

    Application.EnableCancelKey = xlErrorHandler
    Application.DisplayStatusBar = True
    Randomize

    ' --------------------------------------------------------
    ' Planilha
    ' --------------------------------------------------------
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets(NOME_PLANILHA)
    On Error GoTo TrataErro

    If ws Is Nothing Then
        MsgBox "A aba '" & NOME_PLANILHA & "' nao foi encontrada neste arquivo.", _
               vbExclamation, "Aba nao encontrada"
        GoTo Finalizar
    End If

    If TextoDoValor(ws.Cells(LINHA_CABECALHO, COL_STATUS_CLIENTE).Value) = "" Then
        ws.Cells(LINHA_CABECALHO, COL_STATUS_CLIENTE).Value = "Status Cliente"
    End If

    ultimaLinha = UltimaLinhaPreenchida(ws)

    If ultimaLinha < PRIMEIRA_LINHA Then
        MsgBox "Nao ha PDVs para processar na aba " & NOME_PLANILHA & ".", _
               vbInformation, "Sem dados"
        GoTo Finalizar
    End If

    ' --------------------------------------------------------
    ' Le tudo de uma vez e agrupa por PDV
    ' --------------------------------------------------------
    ultimaCol = Application.Max(COL_PDV, COL_NOME_FANTASIA, COL_TELEFONE_PDV, COL_STATUS_CLIENTE)
    dados = ws.Range(ws.Cells(PRIMEIRA_LINHA, 1), ws.Cells(ultimaLinha, ultimaCol)).Value

    Set dLinhas = CreateObject("Scripting.Dictionary")
    Set dFantasia = CreateObject("Scripting.Dictionary")
    Set dTelefone = CreateObject("Scripting.Dictionary")
    dLinhas.CompareMode = vbTextCompare
    dFantasia.CompareMode = vbTextCompare
    dTelefone.CompareMode = vbTextCompare

    For i = 1 To UBound(dados, 1)

        linha = PRIMEIRA_LINHA + i - 1
        pdv = TextoDoValor(dados(i, COL_PDV))
        statusAtual = TextoDoValor(dados(i, COL_STATUS_CLIENTE))

        If pdv <> "" And statusAtual = "" Then

            If Not dLinhas.Exists(pdv) Then
                dLinhas.Add pdv, CStr(linha)
                dFantasia.Add pdv, ""
                dTelefone.Add pdv, ""
            Else
                dLinhas(pdv) = dLinhas(pdv) & ";" & linha
            End If

            If dFantasia(pdv) = "" Then dFantasia(pdv) = TextoDoValor(dados(i, COL_NOME_FANTASIA))
            If dTelefone(pdv) = "" Then dTelefone(pdv) = LimparTelefone(TextoDoValor(dados(i, COL_TELEFONE_PDV)))

        End If

    Next i

    ' PDVs sem telefone valido: registra o erro direto
    Set fila = New Collection
    For Each chave In dLinhas.Keys
        If dTelefone(chave) = "" And TELEFONE_TESTE = "" Then
            RegistrarStatus ws, dLinhas(chave), "ERRO - Telefone invalido ou vazio"
            semTelefone = semTelefone + 1
        Else
            fila.Add CStr(chave)
        End If
    Next chave

    If fila.Count = 0 Then
        MsgBox "Nenhum PDV pendente com telefone valido foi encontrado." & vbCrLf & vbCrLf & _
               "A macro procura registros com:" & vbCrLf & _
               "- PDV preenchido na coluna E;" & vbCrLf & _
               "- Telefone valido na coluna I;" & vbCrLf & _
               "- Status Cliente vazio na coluna L." & vbCrLf & vbCrLf & _
               "PDVs marcados com telefone invalido: " & semTelefone, _
               vbInformation, "Nenhum PDV pendente"
        GoTo Finalizar
    End If

    total = fila.Count
    If LIMITE_POR_EXECUCAO > 0 And total > LIMITE_POR_EXECUCAO Then total = LIMITE_POR_EXECUCAO
    restantes = fila.Count - total

    ' --------------------------------------------------------
    ' Confirmacao
    ' --------------------------------------------------------
    texto = total & " PDV(s) receberao a mensagem de apresentacao." & vbCrLf
    If restantes > 0 Then texto = texto & restantes & " PDV(s) ficarao para a proxima execucao (limite de " & LIMITE_POR_EXECUCAO & ")." & vbCrLf
    If TELEFONE_TESTE <> "" Then texto = texto & "(TESTE: todas para " & TELEFONE_TESTE & ")" & vbCrLf
    If semTelefone > 0 Then texto = texto & semTelefone & " PDV(s) sem telefone valido foram marcados com ERRO." & vbCrLf
    texto = texto & vbCrLf & "Tempo estimado: ~" & Format(total * TempoPorPDV() / 60, "0") & " minuto(s)." & vbCrLf & vbCrLf
    texto = texto & "Deixe o WhatsApp Web aberto como aba ativa do navegador." & vbCrLf
    texto = texto & "Nao utilize o mouse ou o teclado durante o envio." & vbCrLf
    texto = texto & "Para interromper, clique em qualquer janela fora do navegador (ex.: o Excel)." & vbCrLf & vbCrLf
    texto = texto & "Deseja iniciar?"

    If MsgBox(texto, vbYesNo + vbQuestion, "Apresentacao aos PDVs") <> vbYes Then GoTo Finalizar

    ' --------------------------------------------------------
    ' WhatsApp Web: usa a aba ja aberta (so abre se nao achar)
    ' --------------------------------------------------------
    mJanelaWpp = LocalizarJanelaWhatsApp()

    If mJanelaWpp = 0 Then
        ThisWorkbook.FollowHyperlink "https://web.whatsapp.com"
        Esperar SEG_CARREGAR_WHATSAPP
        mJanelaWpp = LocalizarJanelaWhatsApp()
    End If

    If mJanelaWpp = 0 Then
        MsgBox "Nao encontrei o WhatsApp Web aberto no navegador." & vbCrLf & _
               "Abra https://web.whatsapp.com, deixe como aba ativa e rode de novo.", _
               vbExclamation, "WhatsApp Web"
        GoTo Finalizar
    End If

    If Not AtivarJanela(mJanelaWpp) Then
        MsgBox "O navegador foi encontrado, mas nao ficou em primeiro plano." & vbCrLf & _
               "Nenhuma mensagem foi enviada.", vbExclamation, "WhatsApp Web"
        GoTo Finalizar
    End If

    ' ========================================================
    ' ENVIA UM PDV POR VEZ
    ' ========================================================
    Application.ScreenUpdating = False

    For n = 1 To total

        pdvAtual = fila(n)
        telefone = dTelefone(pdvAtual)
        If TELEFONE_TESTE <> "" Then telefone = LimparTelefone(TELEFONE_TESTE)

        Application.StatusBar = "PDV " & n & " de " & total & ": " & pdvAtual & " -> " & telefone

        mensagem = MontarMensagem(pdvAtual, dFantasia(pdvAtual))
        motivo = ""

        res = EnviarMensagemWhatsApp(telefone, mensagem, motivo)

        Select Case res

            Case RES_ENVIADO
                RegistrarStatus ws, dLinhas(pdvAtual), "ENVIADO " & Format(Now, "dd/mm/yyyy hh:nn")
                enviados = enviados + 1

            Case RES_FALHOU
                RegistrarStatus ws, dLinhas(pdvAtual), "NAO ENVIADO - " & motivo
                falhas = falhas + 1
                listaFalhas = listaFalhas & "  - PDV " & pdvAtual & ": " & motivo & vbCrLf

            Case RES_INCERTO
                RegistrarStatus ws, dLinhas(pdvAtual), "VERIFICAR - confira no WhatsApp se foi enviada"
                interrompido = True
                motivoParada = motivo
                Exit For

            Case Else
                interrompido = True
                motivoParada = motivo
                Exit For

        End Select

        If (enviados + falhas) Mod SALVAR_A_CADA = 0 Then ThisWorkbook.Save

        ' Pausa aleatoria entre os envios (reduz risco de bloqueio por spam)
        If n < total Then
            Application.StatusBar = "Aguardando antes do proximo PDV... (" & n & " de " & total & " concluidos)"
            If Not EsperarComFoco(SEG_INTERVALO_MIN + Rnd * (SEG_INTERVALO_MAX - SEG_INTERVALO_MIN)) Then
                interrompido = True
                motivoParada = "o navegador perdeu o foco (envio interrompido)"
                Exit For
            End If
        End If

    Next n

    Application.ScreenUpdating = True
    ThisWorkbook.Save
    AtivarJanela CLngPtr(Application.hwnd)

    ' --------------------------------------------------------
    ' Resumo
    ' --------------------------------------------------------
    texto = IIf(interrompido, "Envio INTERROMPIDO: " & motivoParada, "Processamento concluido.") & vbCrLf & vbCrLf
    texto = texto & "Enviados: " & enviados & vbCrLf
    texto = texto & "Nao enviados: " & falhas & vbCrLf
    texto = texto & "Sem telefone valido: " & semTelefone & vbCrLf
    If restantes > 0 Then texto = texto & "Ficaram para a proxima execucao (limite): " & restantes & vbCrLf
    If listaFalhas <> "" Then texto = texto & vbCrLf & "Nao enviados:" & vbCrLf & listaFalhas

    MsgBox texto, IIf(interrompido Or falhas > 0, vbExclamation, vbInformation), "Apresentacao aos PDVs"

Finalizar:

    On Error Resume Next
    Application.ScreenUpdating = True
    Application.StatusBar = False
    Application.EnableCancelKey = xlInterrupt
    On Error GoTo 0
    Exit Sub


TrataErro:

    numeroErro = Err.Number
    descricaoErro = Err.Description

    On Error Resume Next
    Application.ScreenUpdating = True
    ThisWorkbook.Save
    Application.StatusBar = False
    Application.EnableCancelKey = xlInterrupt
    AtivarJanela CLngPtr(Application.hwnd)
    On Error GoTo 0

    If numeroErro = 18 Then
        MsgBox "O envio foi interrompido." & vbCrLf & vbCrLf & _
               "PDV atual: " & pdvAtual & vbCrLf & _
               "Enviados: " & enviados, _
               vbExclamation, "Envio interrompido"
    Else
        MsgBox "Erro " & numeroErro & ":" & vbCrLf & descricaoErro & vbCrLf & vbCrLf & _
               "PDV atual: " & pdvAtual & vbCrLf & _
               "Enviados ate aqui: " & enviados, _
               vbCritical, "Erro no envio"
    End If

End Sub


' ============================================================
' MENSAGEM DE APRESENTACAO
' ============================================================
Private Function MontarMensagem(ByVal pdv As String, ByVal fantasia As String) As String

    Dim t As String

    ' *texto* = negrito no WhatsApp
    t = "Olá, tudo bem? " & Emoji(&H1F44B) & vbLf & vbLf
    t = t & "Aqui é o *" & NOME_REMETENTE & "*, do time *Financeiro* da *" & EMPRESA & "* " & ChrW(&H2013&) & " " & UNIDADE & "." & vbLf & vbLf
    t = t & "Estou entrando em contato sobre o seguinte cadastro:" & vbLf & vbLf
    t = t & Emoji(&H1F3EA) & " *PDV:* " & pdv & vbLf
    If fantasia <> "" Then t = t & Emoji(&H1F4CB) & " *Nome Fantasia:* " & fantasia & vbLf
    t = t & vbLf
    t = t & "Identificamos um ponto nesse cadastro que gostaríamos de conversar diretamente com você, "
    t = t & "para entender a situação e, juntos, encontrar a melhor forma de seguir." & vbLf & vbLf
    t = t & "Antes de tudo, pode me confirmar se este número é do *responsável pelo estabelecimento*?" & vbLf & vbLf
    t = t & "Assim que você confirmar, te explico tudo certinho. Obrigado!"

    MontarMensagem = t

End Function

' Monta um emoji a partir do codigo Unicode (ex.: &H1F44B = mao acenando)
Private Function Emoji(ByVal codigo As Long) As String

    codigo = codigo - &H10000
    Emoji = ChrW(&HD800& + (codigo \ &H400&)) & ChrW(&HDC00& + (codigo And &H3FF&))

End Function


' ============================================================
' ENVIA UMA MENSAGEM DE TEXTO PARA UM NUMERO
' Abre web.whatsapp.com/send?phone=...&text=... na MESMA aba,
' espera a mensagem aparecer na caixa, envia e confere.
' ============================================================
Private Function EnviarMensagemWhatsApp(ByVal telefone As String, ByVal mensagem As String, _
                                        ByRef motivo As String) As Long

    Dim url As String
    Dim conteudo As String
    Dim alvo As String
    Dim t0 As Double
    Dim pronto As Boolean

    If Not ForegroundEhJanela(mJanelaWpp) Then
        motivo = "o navegador perdeu o foco (envio interrompido)"
        EnviarMensagemWhatsApp = RES_ABORTAR
        Exit Function
    End If

    ' 1) Abre a conversa pelo link (barra de endereco: Ctrl+L)
    url = "https://web.whatsapp.com/send?phone=" & telefone & "&text=" & CodificarUrl(mensagem)

    If Not ColocarTextoClipboard(url) Then
        motivo = "falha ao usar a area de transferencia"
        EnviarMensagemWhatsApp = RES_FALHOU
        Exit Function
    End If

    PressionarTecla VK_ESCAPE
    PressionarCombinacao True, False, False, VK_L
    Esperar 0.15
    PressionarCombinacao True, False, False, VK_V
    Esperar 0.1
    PressionarTecla VK_RETURN

    ' 2) Espera a conversa abrir com a mensagem ja na caixa de texto
    alvo = Normalizar(mensagem)
    t0 = Agora()

    Do
        If Not EsperarComFoco(SEG_ENTRE_VERIFICACOES) Then
            motivo = "o navegador perdeu o foco (envio interrompido)"
            EnviarMensagemWhatsApp = RES_ABORTAR
            Exit Function
        End If

        conteudo = Normalizar(CopiarConteudoCampo())

        If conteudo = alvo Then
            pronto = True
            Exit Do
        End If

        ' Aviso do WhatsApp: "O numero de telefone compartilhado atraves de url e invalido"
        If InStr(1, conteudo, "urleinvalido") > 0 Or InStr(1, conteudo, "urlisinvalid") > 0 Then
            motivo = "numero sem WhatsApp ou invalido"
            Exit Do
        End If

    Loop While Agora() - t0 < SEG_TIMEOUT_CONVERSA

    If Not pronto Then
        If motivo = "" Then motivo = "a conversa nao abriu em " & SEG_TIMEOUT_CONVERSA & "s"
        PressionarTecla VK_ESCAPE
        EnviarMensagemWhatsApp = RES_FALHOU
        Exit Function
    End If

    ' 3) Envia
    PressionarCombinacao True, False, False, VK_END
    If Not ForegroundEhJanela(mJanelaWpp) Then
        motivo = "o navegador perdeu o foco (envio interrompido)"
        EnviarMensagemWhatsApp = RES_ABORTAR
        Exit Function
    End If
    PressionarTecla VK_RETURN

    ' 4) Confere: a caixa de texto deve ficar vazia (segue assim que esvaziar)
    t0 = Agora()
    Do
        If Not EsperarComFoco(SEG_ENTRE_VERIFICACOES) Then
            motivo = "o navegador perdeu o foco logo apos o envio"
            EnviarMensagemWhatsApp = RES_INCERTO
            Exit Function
        End If

        If CampoAtualVazio() Then
            ' Folga para a mensagem sair antes de trocar de conversa
            If Not EsperarComFoco(SEG_APOS_ENVIAR) Then
                motivo = "o navegador perdeu o foco logo apos o envio"
                EnviarMensagemWhatsApp = RES_INCERTO
                Exit Function
            End If
            EnviarMensagemWhatsApp = RES_ENVIADO
            Exit Function
        End If
    Loop While Agora() - t0 < SEG_TIMEOUT_ENVIO

    ' Nao saiu: apaga o texto para nao ficar rascunho na conversa
    PressionarCombinacao True, False, False, VK_A
    PressionarTecla VK_BACK
    motivo = "envio nao confirmado (o texto ficou na caixa)"
    EnviarMensagemWhatsApp = RES_FALHOU

End Function


' ============================================================
' CODIFICA O TEXTO PARA URL (UTF-8, acentos e quebras de linha)
' ============================================================
Private Function CodificarUrl(ByVal s As String) As String

    Dim i As Long
    Dim c As Long
    Dim baixo As Long
    Dim cp As Long
    Dim r As String

    i = 1
    Do While i <= Len(s)

        c = AscW(Mid$(s, i, 1)) And &HFFFF&

        Select Case c
            Case 48 To 57, 65 To 90, 97 To 122, 45, 46, 95, 126     ' 0-9 A-Z a-z - . _ ~
                r = r & ChrW(c)
            Case Is < &H80&
                r = r & ByteUrl(c)
            Case Is < &H800&
                r = r & ByteUrl(&HC0& Or (c \ &H40&)) & ByteUrl(&H80& Or (c And &H3F&))
            Case &HD800& To &HDBFF&
                ' par substituto (emoji etc.)
                If i < Len(s) Then
                    baixo = AscW(Mid$(s, i + 1, 1)) And &HFFFF&
                    cp = &H10000 + (c - &HD800&) * &H400& + (baixo - &HDC00&)
                    r = r & ByteUrl(&HF0& Or (cp \ &H40000)) & _
                            ByteUrl(&H80& Or ((cp \ &H1000&) And &H3F&)) & _
                            ByteUrl(&H80& Or ((cp \ &H40&) And &H3F&)) & _
                            ByteUrl(&H80& Or (cp And &H3F&))
                    i = i + 1
                End If
            Case Else
                r = r & ByteUrl(&HE0& Or (c \ &H1000&)) & _
                        ByteUrl(&H80& Or ((c \ &H40&) And &H3F&)) & _
                        ByteUrl(&H80& Or (c And &H3F&))
        End Select

        i = i + 1
    Loop

    CodificarUrl = r

End Function

Private Function ByteUrl(ByVal b As Long) As String
    ByteUrl = "%" & Right$("0" & Hex$(b), 2)
End Function


' ============================================================
' VERIFICACAO DO CAMPO FOCADO (Ctrl+A / Ctrl+C)
' ============================================================
Private Function CopiarConteudoCampo() As String

    Dim ok As Boolean

    If Not ColocarTextoClipboard(SENTINELA) Then Exit Function
    PressionarCombinacao True, False, False, VK_A
    PressionarCombinacao True, False, False, VK_C
    Esperar 0.12
    CopiarConteudoCampo = LerTextoClipboard(ok)

End Function

Private Function CampoAtualVazio() As Boolean

    Dim s As String

    s = CopiarConteudoCampo()
    CampoAtualVazio = (s = SENTINELA Or Len(Normalizar(s)) = 0)

End Function


' ============================================================
' REGISTRA STATUS NAS LINHAS DO PDV (coluna L)
' ============================================================
Private Sub RegistrarStatus(ByVal ws As Worksheet, ByVal linhas As String, ByVal status As String)

    Dim item As Variant

    For Each item In Split(linhas, ";")
        ws.Cells(CLng(item), COL_STATUS_CLIENTE).Value = status
    Next item

End Sub


' ============================================================
' ULTIMA LINHA PREENCHIDA
' ============================================================
Private Function UltimaLinhaPreenchida(ByVal ws As Worksheet) As Long

    UltimaLinhaPreenchida = Application.Max( _
        ws.Cells(ws.Rows.Count, COL_PDV).End(xlUp).Row, _
        ws.Cells(ws.Rows.Count, COL_NOME_FANTASIA).End(xlUp).Row, _
        ws.Cells(ws.Rows.Count, COL_TELEFONE_PDV).End(xlUp).Row)

End Function


' ============================================================
' TEXTO DE UM VALOR (erros #N/D, #VALOR! etc. viram vazio)
' ============================================================
Private Function TextoDoValor(ByVal valor As Variant) As String

    If IsError(valor) Or IsEmpty(valor) Then Exit Function

    If IsNumeric(valor) And VarType(valor) <> vbString And VarType(valor) <> vbBoolean Then
        If CDbl(valor) = Fix(CDbl(valor)) Then
            TextoDoValor = Format(valor, "0")          ' evita 1,99872E+10 em telefones
        Else
            TextoDoValor = Trim$(CStr(valor))
        End If
    Else
        TextoDoValor = Trim$(CStr(valor))
    End If

End Function


' ============================================================
' LIMPA E VALIDA O NUMERO DO TELEFONE
' ============================================================
Private Function LimparTelefone(ByVal valor As String) As String

    Dim i As Long
    Dim caractere As String
    Dim digitos As String

    For i = 1 To Len(valor)
        caractere = Mid$(valor, i, 1)
        If caractere Like "#" Then digitos = digitos & caractere
    Next i

    Do While Left$(digitos, 1) = "0"
        digitos = Mid$(digitos, 2)
    Loop

    If (Len(digitos) = 12 Or Len(digitos) = 13) And Left$(digitos, 2) = DDI Then
        LimparTelefone = digitos
    ElseIf Len(digitos) = 10 Or Len(digitos) = 11 Then
        LimparTelefone = DDI & digitos
    Else
        LimparTelefone = ""
    End If

End Function


' ============================================================
' AREA DE TRANSFERENCIA (API do Windows)
' ============================================================
Private Function AbrirClipboard() As Boolean

    Dim i As Long

    For i = 1 To 40
        If OpenClipboard(0) <> 0 Then
            AbrirClipboard = True
            Exit Function
        End If
        Sleep 25
    Next i

End Function

Private Function ColocarTextoClipboard(ByVal texto As String) As Boolean

    Dim hMem As LongPtr
    Dim p As LongPtr

    hMem = GlobalAlloc(GHND, LenB(texto) + 2)
    If hMem = 0 Then Exit Function

    p = GlobalLock(hMem)
    If p = 0 Then
        GlobalFree hMem
        Exit Function
    End If
    If LenB(texto) > 0 Then CopyMemory p, StrPtr(texto), LenB(texto)
    GlobalUnlock hMem

    If Not AbrirClipboard() Then
        GlobalFree hMem
        Exit Function
    End If

    EmptyClipboard
    If SetClipboardData(CF_UNICODETEXT, hMem) = 0 Then
        CloseClipboard
        GlobalFree hMem
        Exit Function
    End If
    CloseClipboard

    ColocarTextoClipboard = True

End Function

Private Function LerTextoClipboard(ByRef ok As Boolean) As String

    Dim h As LongPtr
    Dim p As LongPtr
    Dim n As Long
    Dim s As String

    ok = False
    If Not AbrirClipboard() Then Exit Function
    ok = True

    If IsClipboardFormatAvailable(CF_UNICODETEXT) <> 0 Then
        h = GetClipboardData(CF_UNICODETEXT)
        If h <> 0 Then
            p = GlobalLock(h)
            If p <> 0 Then
                n = lstrlenW(p)
                If n > 0 Then
                    s = String$(n, vbNullChar)
                    CopyMemory StrPtr(s), p, CLngPtr(n) * 2
                End If
                GlobalUnlock h
            End If
        End If
    End If

    CloseClipboard
    LerTextoClipboard = s

End Function


' ============================================================
' TECLADO (keybd_event: nao mexe no NumLock como o SendKeys)
' ============================================================
Private Sub EventoTecla(ByVal vk As Long, ByVal soltar As Boolean)

    Dim flags As Long
    Dim sc As Long

    sc = MapVirtualKeyW(vk, 0) And &HFF&
    If vk = VK_END Then flags = KEYEVENTF_EXTENDEDKEY
    If soltar Then flags = flags Or KEYEVENTF_KEYUP
    keybd_event CByte(vk And &HFF&), CByte(sc), flags, 0

End Sub

Private Sub PressionarTecla(ByVal vk As Long)

    EventoTecla vk, False
    Sleep 20
    EventoTecla vk, True
    Esperar SEG_ESPERA_TECLA

End Sub

Private Sub PressionarCombinacao(ByVal ctrl As Boolean, ByVal alt As Boolean, ByVal shift As Boolean, ByVal vk As Long)

    If ctrl Then EventoTecla VK_CONTROL, False
    If alt Then EventoTecla VK_MENU, False
    If shift Then EventoTecla VK_SHIFT, False
    Sleep 20
    EventoTecla vk, False
    Sleep 20
    EventoTecla vk, True
    Sleep 20
    If shift Then EventoTecla VK_SHIFT, True
    If alt Then EventoTecla VK_MENU, True
    If ctrl Then EventoTecla VK_CONTROL, True
    Esperar SEG_ESPERA_TECLA

End Sub


' ============================================================
' LOCALIZA A JANELA DO NAVEGADOR COM O WHATSAPP WEB
' (funciona mesmo com titulo "(3) WhatsApp - Google Chrome")
' ============================================================
Private Function LocalizarJanelaWhatsApp() As LongPtr

    Const GW_HWNDNEXT As Long = 2
    Const GW_CHILD As Long = 5

    Dim h As LongPtr
    Dim titulo As String

    h = GetWindow(GetDesktopWindow(), GW_CHILD)

    Do While h <> 0
        If IsWindowVisible(h) <> 0 Then
            titulo = TituloJanela(h)
            If InStr(1, titulo, "WhatsApp", vbTextCompare) > 0 And EhNavegador(titulo) Then
                LocalizarJanelaWhatsApp = h
                Exit Function
            End If
        End If
        h = GetWindow(h, GW_HWNDNEXT)
    Loop

End Function

Private Function TituloJanela(ByVal h As LongPtr) As String

    Dim n As Long
    Dim buffer As String

    n = GetWindowTextLengthW(h)
    If n = 0 Then Exit Function

    buffer = String$(n + 1, vbNullChar)
    GetWindowTextW h, StrPtr(buffer), n + 1
    TituloJanela = Left$(buffer, n)

End Function

Private Function EhNavegador(ByVal titulo As String) As Boolean

    Dim nome As Variant

    For Each nome In Array("Chrome", "Edge", "Firefox", "Opera", "Brave", "Vivaldi")
        If InStr(1, titulo, nome, vbTextCompare) > 0 Then
            EhNavegador = True
            Exit Function
        End If
    Next nome

End Function


' ============================================================
' PRIMEIRO PLANO DAS JANELAS
' ============================================================
Private Function AtivarJanela(ByVal hwnd As LongPtr) As Boolean

    Dim hFg As LongPtr
    Dim idEste As Long, idFg As Long, idAlvo As Long, pid As Long
    Dim anexouFg As Boolean, anexouAlvo As Boolean

    If hwnd = 0 Then Exit Function
    If IsWindow(hwnd) = 0 Then Exit Function

    If ForegroundEhJanela(hwnd) Then
        AtivarJanela = True
        Exit Function
    End If

    If IsIconic(hwnd) <> 0 Then
        ShowWindow hwnd, SW_RESTORE
        Esperar 0.25
    End If

    AllowSetForegroundWindow ASFW_ANY
    idEste = GetCurrentThreadId()
    hFg = GetForegroundWindow()
    If hFg <> 0 Then idFg = GetWindowThreadProcessId(hFg, pid)
    idAlvo = GetWindowThreadProcessId(hwnd, pid)

    If idFg <> 0 And idFg <> idEste Then anexouFg = (AttachThreadInput(idEste, idFg, 1) <> 0)
    If idAlvo <> 0 And idAlvo <> idEste And idAlvo <> idFg Then anexouAlvo = (AttachThreadInput(idEste, idAlvo, 1) <> 0)

    ShowWindow hwnd, SW_SHOW
    BringWindowToTop hwnd
    SetForegroundWindow hwnd
    SetActiveWindow hwnd

    If anexouAlvo Then AttachThreadInput idEste, idAlvo, 0
    If anexouFg Then AttachThreadInput idEste, idFg, 0

    If AguardarPrimeiroPlano(hwnd, 1.5) Then
        Esperar 0.5
        AtivarJanela = True
        Exit Function
    End If

    ' Alternativa: minimizar e restaurar
    ShowWindow hwnd, SW_MINIMIZE
    Esperar 0.2
    ShowWindow hwnd, SW_RESTORE
    Esperar 0.2
    BringWindowToTop hwnd
    SetForegroundWindow hwnd

    If AguardarPrimeiroPlano(hwnd, 3) Then
        Esperar 0.5
        AtivarJanela = True
    End If

End Function

Private Function ForegroundEhJanela(ByVal hwnd As LongPtr) As Boolean

    Dim fg As LongPtr

    fg = GetForegroundWindow()
    If fg = 0 Or hwnd = 0 Then Exit Function

    If fg = hwnd Then
        ForegroundEhJanela = True
    ElseIf GetAncestor(fg, GA_ROOTOWNER) = hwnd Then
        ForegroundEhJanela = True
    End If

End Function

Private Function AguardarPrimeiroPlano(ByVal hwnd As LongPtr, ByVal segundos As Double) As Boolean

    Dim fim As Double

    fim = Agora() + segundos
    Do
        If ForegroundEhJanela(hwnd) Then
            AguardarPrimeiroPlano = True
            Exit Function
        End If
        Sleep 50
        DoEvents
    Loop While Agora() < fim

End Function

' Espera o tempo informado; retorna False se o navegador perder o foco
' (e assim que o usuario interrompe: clicando em outra janela)
Private Function EsperarComFoco(ByVal segundos As Double) As Boolean

    Dim fim As Double

    fim = Agora() + segundos
    Do
        If Not ForegroundEhJanela(mJanelaWpp) Then Exit Function
        DoEvents
        Sleep 50
    Loop While Agora() < fim

    EsperarComFoco = ForegroundEhJanela(mJanelaWpp)

End Function


' ============================================================
' UTILITARIOS
' ============================================================
' Deixa so letras e numeros (sem acento) para comparar textos
Private Function Normalizar(ByVal s As String) As String

    Dim i As Long, c As Long, r As String

    s = LCase$(s)
    For i = 1 To Len(s)
        c = AscW(Mid$(s, i, 1))
        Select Case c
            Case 48 To 57, 97 To 122: r = r & ChrW(c)
            Case 224 To 229: r = r & "a"
            Case 231: r = r & "c"
            Case 232 To 235: r = r & "e"
            Case 236 To 239: r = r & "i"
            Case 241: r = r & "n"
            Case 242 To 246: r = r & "o"
            Case 249 To 252: r = r & "u"
        End Select
    Next i

    Normalizar = r

End Function

Private Function TempoPorPDV() As Double

    ' ~5s para a conversa abrir + envio + pausa media entre PDVs
    TempoPorPDV = 5 + 1 + SEG_APOS_ENVIAR + (SEG_INTERVALO_MIN + SEG_INTERVALO_MAX) / 2

End Function

Private Function Agora() As Double

    Agora = CDbl(Date) * 86400# + Timer

End Function

Private Sub Esperar(ByVal segundos As Double)

    Dim fim As Double

    If segundos <= 0 Then Exit Sub
    fim = Agora() + segundos
    Do
        DoEvents
        Sleep 20
    Loop While Agora() < fim

End Sub
