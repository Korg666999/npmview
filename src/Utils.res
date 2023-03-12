let unpkgUrl = "https://unpkg.com" // TODO: env

let fetchPackageJson = async packageName => {
  open Webapi.Fetch
  let res = await fetch(`${unpkgUrl}/${packageName}/package.json`)
  let json = await res->Response.json
  json->Model.PackageJson.decode
}

let fetchMeta = async packageName => {
  open Webapi.Fetch
  let res = await fetch(`${unpkgUrl}/${packageName}/?meta`)
  let json = await res->Response.json
  json->Model.Meta.decode
}

let fetchCode = async (packageName, path) => {
  open Webapi.Fetch
  let res = await fetch(`${unpkgUrl}/${packageName}${path}`)
  await res->Response.text
}

type state<'a> = {loading: bool, data: option<'a>, error: option<Exn.t>}
type action<'a> = Init | Data('a) | Error(Exn.t)

let useQuery = (~fn) => {
  let reducer = (state, action) => {
    switch action {
    | Init => {...state, loading: true}
    | Data(data) => {...state, loading: false, data: data->Some}
    | Error(error) => {...state, loading: false, error: error->Some}
    }
  }
  let (state, dispatch) = React.useReducer(reducer, {loading: false, data: None, error: None})

  React.useEffect1(() => {
    let init = async () => {
      Init->dispatch
      try {
        let data = await fn()
        Data(data)->dispatch
      } catch {
      | Exn.Error(obj) => Error(obj)->dispatch // TODO: toast
      }
    }
    let _ = init()
    None
  }, [fn])

  state
}
