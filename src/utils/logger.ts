// src/utils/logger.ts
export const LogLevel = {
	DEBUG: 'DEBUG',
	INFO: 'INFO',
	WARN: 'WARN',
	ERROR: 'ERROR',
} as const

type LogLevel = (typeof LogLevel)[keyof typeof LogLevel]

interface LogMessage {
	id: number
	component: string
	message: string
	level: LogLevel
	data?: any
}

export class Logger {
	private static currentId = 0
	private static logs: LogMessage[] = []

	static log(
		component: string,
		message: string,
		level: LogLevel = LogLevel.INFO,
		data?: any
	) {
		const logMessage: LogMessage = {
			id: ++this.currentId,
			component,
			message,
			level,
			data: data ? this.sanitizeData(data) : undefined,
		}

		this.logs.push(logMessage)

		// Format du log : [ID] NIVEAU [COMPOSANT] Message
		console.log(
			`[${logMessage.id.toString().padStart(3, '0')}] ${level} [${component}] ${message}`,
			data ? '\nData:' + data : ''
		)
	}

	static debug(component: string, message: string, data?: any) {
		this.log(component, message, LogLevel.DEBUG, data)
	}

	static info(component: string, message: string, data?: any) {
		this.log(component, message, LogLevel.INFO, data)
	}

	static warn(component: string, message: string, data?: any) {
		this.log(component, message, LogLevel.WARN, data)
	}

	static error(component: string, message: string, data?: any) {
		this.log(component, message, LogLevel.ERROR, data)
	}

	static getLogs(): LogMessage[] {
		return [...this.logs]
	}

	static clear() {
		this.logs = []
		this.currentId = 0
	}

	private static sanitizeData(data: any): any {
		if (!data) return data

		// Copie profonde avec retrait des données sensibles
		const sanitized = JSON.parse(JSON.stringify(data))
		this.removeSensitiveData(sanitized)
		return sanitized
	}

	private static removeSensitiveData(obj: any) {
		const sensitiveKeys = ['apiKey', 'token', 'password', 'secret']
		if (typeof obj !== 'object') return

		for (const key in obj) {
			if (sensitiveKeys.includes(key.toLowerCase())) {
				obj[key] = '***REDACTED***'
			} else if (typeof obj[key] === 'object') {
				this.removeSensitiveData(obj[key])
			}
		}
	}
}
