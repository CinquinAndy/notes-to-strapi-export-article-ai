/**
 * Creates a debounced version of the provided function
 * @param func The function to debounce
 * @param waitFor The time to wait in milliseconds
 * @returns A debounced version of the function that returns a promise
 */
export function debounce<F extends (...args: any[]) => any>(
	func: F,
	waitFor: number
): (...args: Parameters<F>) => Promise<ReturnType<F>> {
	let timeout: ReturnType<typeof setTimeout> | null = null

	return (...args: Parameters<F>): Promise<ReturnType<F>> => {
		// Clear existing timeout if any
		if (timeout) {
			clearTimeout(timeout)
			timeout = null
		}

		// Create new promise
		return new Promise((resolve, reject) => {
			timeout = setTimeout(async () => {
				try {
					const result = await func(...args)
					resolve(result)
				} catch (error) {
					reject(error)
				} finally {
					timeout = null
				}
			}, waitFor)
		})
	}
}
