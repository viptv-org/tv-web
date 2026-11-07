' Generic Task-thread worker.
'
' TypeScript cannot execute inside a SceneGraph Task (the Task thread runs
' BrightScript). The TS side posts { op, ... } and receives { ok, result }.
' Add operations here when an app needs genuinely parallel background work.

sub init()
    m.top.functionName = "runWorker"
end sub

sub runWorker()
    response = { ok: false, error: "invalid request", result: invalid }
    request = m.top.request

    if request = invalid then
        m.top.response = response
        return
    end if

    op = request.op

    if op = "echo" then
        response = { ok: true, error: "", result: request.value }
    else if op = "sleep" then
        ms = 0
        if request.ms <> invalid then ms = Int(request.ms)
        if ms > 0 then sleep(ms)
        response = { ok: true, error: "", result: ms }
    else if op = "json" then
        parsed = ParseJson(request.text)
        if parsed = invalid then
            response = { ok: false, error: "invalid json", result: invalid }
        else
            response = { ok: true, error: "", result: FormatJson(parsed) }
        end if
    else if op = "fetch" then
        transfer = CreateObject("roUrlTransfer")
        transfer.SetUrl(request.url)
        if request.headers <> invalid then
            for each key in request.headers
                transfer.AddHeader(key, request.headers[key])
            end for
        end if
        body = transfer.GetToString()
        response = { ok: true, error: "", result: body }
    else if op = "http" then
        transfer = CreateObject("roUrlTransfer")
        transfer.SetCertificatesFile("common:/certs/ca-bundle.crt")
        transfer.InitClientCertificates()
        transfer.EnablePeerVerification(true)
        transfer.EnableHostVerification(true)
        transfer.RetainBodyOnError(true)
        transfer.SetUrl(request.url)
        if request.DoesExist("headers") and request["headers"] <> invalid then
            headersIn = request["headers"]
            for each key in headersIn
                transfer.AddHeader(key, headersIn[key])
            end for
        end if
        method = "GET"
        if request.DoesExist("method") and request["method"] <> invalid then method = UCase(request["method"])
        body = ""
        if request.DoesExist("payload") and request["payload"] <> invalid then
            payloadType = type(request["payload"])
            if payloadType = "roAssociativeArray" or payloadType = "roArray" then
                body = FormatJson(request["payload"])
            else
                body = request["payload"]
            end if
        end if
        transfer.SetRequest(method)
        port = CreateObject("roMessagePort")
        transfer.SetMessagePort(port)
        if method = "GET" then
            started = transfer.AsyncGetToString()
        else
            started = transfer.AsyncPostFromString(body)
        end if
        if not started then
            response = { ok: false, error: "Could not start the HTTP request.", result: invalid }
        else
            event = wait(60000, port)
            if type(event) = "roUrlEvent" then
                status = event.GetResponseCode()
                text = event.GetString()
                response = { ok: true, error: "", result: { status: status, body: text, headers: {} } }
            else
                response = { ok: false, error: "The HTTP request timed out.", result: invalid }
            end if
        end if
    else
        response = { ok: false, error: "unknown op: " + ToStr(op), result: invalid }
    end if

    m.top.response = response
end sub
