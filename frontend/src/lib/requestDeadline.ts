export async function requestDeadline<T>(request: (signal: AbortSignal) => PromiseLike<T>, milliseconds = 12000): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      Promise.resolve().then(() => request(controller.signal)),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error('La conexión tardó demasiado')) }, milliseconds)
      }),
    ])
  } finally { clearTimeout(timer) }
}
