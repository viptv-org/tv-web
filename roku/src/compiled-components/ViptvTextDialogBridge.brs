sub init()
    m.dialog = invalid
    m.finished = false
end sub

sub openDialog()
    request = m.top.request
    if request = invalid then return
    scene = m.top.getScene()
    if scene = invalid then
        m.top.result = { action: "failed" }
        return
    end if
    if scene.dialog <> invalid then
        if scene.dialog.id <> "viptv-native-text-entry" then
            m.top.result = { action: "failed" }
            return
        end if
        scene.dialog.close = true
    end if
    m.finished = false
    m.valueField = "text"
    nodeType = "StandardKeyboardDialog"
    if request.numeric then
        nodeType = "StandardPinPadDialog"
        m.valueField = "pin"
    end if
    m.dialog = CreateObject("roSGNode", nodeType)
    m.dialog.id = "viptv-native-text-entry"
    m.dialog.title = request.title
    m.dialog.buttons = [request.confirm, "Cancel"]
    if not request.numeric then m.dialog.keyboardDomain = "generic"
    m.dialog.textEditBox.maxTextLength = request.maximumLength
    m.dialog.textEditBox.secureMode = request.secret
    m.dialog.textEditBox.clearOnDownKey = false
    m.dialog[m.valueField] = request.initial
    m.dialog.observeFieldScoped(m.valueField, "edited")
    m.dialog.observeFieldScoped("buttonSelected", "selected")
    m.dialog.observeFieldScoped("wasClosed", "dismissed")
    scene.dialog = m.dialog
end sub

sub edited(event as Object)
    if m.finished or m.dialog = invalid then return
    if not m.dialog.isSameNode(event.getRoSGNode()) then return
    m.top.edit = { text: event.getData() }
end sub

sub selected(event as Object)
    if m.finished or m.dialog = invalid then return
    if not m.dialog.isSameNode(event.getRoSGNode()) then return
    if event.getData() = 0 then
        finish("done")
    else
        finish("cancel")
    end if
end sub

sub dismissed(event as Object)
    if m.finished or m.dialog = invalid then return
    if not m.dialog.isSameNode(event.getRoSGNode()) then return
    finish("cancel")
end sub

sub finish(action as String)
    if m.finished or m.dialog = invalid then return
    value = m.dialog[m.valueField]
    closeDialog()
    m.top.result = { action: action, text: value }
end sub

sub closeDialog()
    m.finished = true
    dialog = m.dialog
    m.dialog = invalid
    if dialog = invalid then return
    dialog.unobserveFieldScoped(m.valueField)
    dialog.unobserveFieldScoped("buttonSelected")
    dialog.unobserveFieldScoped("wasClosed")
    scene = dialog.getScene()
    if scene <> invalid then
        if scene.dialog <> invalid then
            if scene.dialog.isSameNode(dialog) then dialog.close = true
        end if
    end if
end sub
