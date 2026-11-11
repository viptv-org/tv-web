sub init()
    m.channels = {}
    m.top.id = "solid-motion-" + createObject("roDeviceInfo").GetRandomUUID()
end sub

sub onXValue()
    position = m.top.translation
    m.top.translation = [m.top.motionX, position[1]]
end sub

sub onYValue()
    position = m.top.translation
    m.top.translation = [position[0], m.top.motionY]
end sub

function currentValue(key as string) as float
    if key = "alpha" then return m.top.opacity
    if key = "x" then return m.top.translation[0]
    return m.top.translation[1]
end function

sub writeValue(key as string, value as float)
    if key = "alpha" then
        m.top.opacity = value
    else if key = "x" then
        m.top.motionX = value
    else
        m.top.motionY = value
    end if
end sub

sub publishState(key as string, state as string)
    channel = m.channels[key]
    m.top[key + "State"] = { serial: channel.request.serial, state: state, value: currentValue(key) }
end sub

sub requestMotion(key as string, request as object)
    if request = invalid then return
    channel = m.channels[key]
    if channel = invalid then
        anim = createObject("roSGNode", "Animation")
        interp = createObject("roSGNode", "FloatFieldInterpolator")
        interp.key = [0, 1]
        field = "opacity"
        if key = "x" then field = "motionX"
        if key = "y" then field = "motionY"
        interp.fieldToInterp = m.top.id + "." + field
        anim.appendChild(interp)
        m.top.appendChild(anim)
        callback = "onAlphaState"
        if key = "x" then callback = "onXState"
        if key = "y" then callback = "onYState"
        anim.observeFieldScoped("state", callback)
        channel = { anim: anim, interp: interp, request: request, changing: false }
        m.channels[key] = channel
    end if
    channel.changing = true
    channel.request = request
    value = currentValue(key)
    action = request.action
    if action = "start" then
        writeValue(key, value)
        channel.interp.keyValue = [value, request.to]
        channel.anim.control = "stop"
        channel.anim.duration = request.duration
        channel.anim.easeFunction = request.easing
        if request.duration <= 0 or abs(value - request.to) < 0.0001 then
            channel.interp.keyValue = [request.to, request.to]
            writeValue(key, request.to)
        else
            channel.anim.control = "start"
        end if
    else if action = "pause" then
        if channel.anim.state = "running" then channel.anim.control = "pause"
    else if action = "resume" then
        if channel.anim.state = "paused" then channel.anim.control = "resume"
    else
        if action = "snap" then value = request.to
        ' Pin both keys before stop, which otherwise resets to the span's start.
        channel.interp.keyValue = [value, value]
        channel.anim.control = "stop"
        writeValue(key, value)
    end if
    channel.changing = false
    publishState(key, channel.anim.state)
end sub

sub onXRequest()
    requestMotion("x", m.top.xRequest)
end sub
sub onYRequest()
    requestMotion("y", m.top.yRequest)
end sub
sub onAlphaRequest()
    requestMotion("alpha", m.top.alphaRequest)
end sub

sub animationState(key as string, event as object)
    channel = m.channels[key]
    if channel.changing then return
    if event.getData() <> channel.anim.state then return
    publishState(key, channel.anim.state)
end sub
sub onXState(event as object)
    animationState("x", event)
end sub
sub onYState(event as object)
    animationState("y", event)
end sub
sub onAlphaState(event as object)
    animationState("alpha", event)
end sub
