{
	admin 127.0.0.1:2019
}

https://invarianceresearch.xyz {
	tls /etc/caddy/certs/origin.pem /etc/caddy/certs/origin.key
	redir https://www.invarianceresearch.xyz{uri} permanent
}

https://www.invarianceresearch.xyz {
	tls /etc/caddy/certs/origin.pem /etc/caddy/certs/origin.key

	encode zstd gzip

	request_body {
		max_size 55MB
	}

	header {
		-Server
		Strict-Transport-Security "max-age=86400"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "strict-origin-when-cross-origin"
		Permissions-Policy "camera=(), microphone=(), geolocation=()"
	}

	log {
		output file /var/log/caddy/invariance-access.log {
			roll_size 50MiB
			roll_keep 10
			roll_keep_for 336h
		}
		format json
	}

	reverse_proxy 127.0.0.1:3101 127.0.0.1:3102 {
		lb_policy round_robin
		health_uri /api/health/live
		health_interval 15s
		health_timeout 5s
		health_fails 2
		health_passes 2
		fail_duration 30s
		max_fails 2

		header_up Host {host}
		header_up X-Forwarded-Host {host}
		header_up X-Forwarded-Proto https
		header_up X-Real-IP {http.request.header.CF-Connecting-IP}
		header_up X-Forwarded-For {http.request.header.CF-Connecting-IP}
	}
}
